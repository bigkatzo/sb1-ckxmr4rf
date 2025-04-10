import { SOLANA_CONNECTION } from '../config/solana';
import { toast } from 'react-toastify';
import { supabase } from '../lib/supabase';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';

// Keep track of processed signatures to prevent duplicate processing
const processedSignatures = new Set<string>();

interface TransactionStatus {
  processing: boolean;
  success: boolean;
  error: string | null;
  signature?: string;
  paymentConfirmed?: boolean;
}

interface TransactionDetails {
  amount: number;
  buyer: string;
  recipient: string;
}

interface Transfer {
  address: string;
  change: number;
}

const MAX_RETRIES = 30;
const INITIAL_DELAY = 1000;

async function verifyTransactionDetails(
  signature: string,
  expectedDetails?: TransactionDetails
): Promise<{ isValid: boolean; error?: string; details?: TransactionDetails }> {
  try {
    const tx = await SOLANA_CONNECTION.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: 'finalized'
    });

    if (!tx || !tx.meta || tx.meta.err) {
      return { 
        isValid: false, 
        error: tx?.meta?.err 
          ? typeof tx.meta.err === 'string' 
            ? `Transaction failed: ${tx.meta.err}`
            : 'Transaction failed with an error'
          : 'Transaction not found' 
      };
    }

    // Get pre and post balances
    const preBalances = tx.meta.preBalances;
    const postBalances = tx.meta.postBalances;
    
    // Get accounts involved in the transaction
    const accounts = tx.transaction.message.getAccountKeys().keySegments().flat();
    
    // Find the transfer by looking at balance changes
    const transfers: Transfer[] = accounts.map((account: PublicKey, index: number) => {
      const balanceChange = (postBalances[index] - preBalances[index]) / LAMPORTS_PER_SOL;
      return {
        address: account.toBase58(),
        change: balanceChange
      };
    });

    // Find the recipient (positive balance change) and sender (negative balance change)
    const recipient = transfers.find((t: Transfer) => t.change > 0);
    const sender = transfers.find((t: Transfer) => t.change < 0);

    if (!recipient || !sender) {
      return { 
        isValid: false, 
        error: 'Could not identify transfer details'
      };
    }
    
    const details = {
      amount: recipient.change,
      buyer: sender.address,
      recipient: recipient.address
    };

    // If we have expected details, verify them
    if (expectedDetails) {
      if (Math.abs(details.amount - expectedDetails.amount) > 0.00001) { // Allow small rounding differences
        return {
          isValid: false,
          error: `Amount mismatch: expected ${expectedDetails.amount} SOL, got ${details.amount} SOL`,
          details
        };
      }

      if (details.buyer.toLowerCase() !== expectedDetails.buyer.toLowerCase()) {
        return {
          isValid: false,
          error: `Buyer mismatch: expected ${expectedDetails.buyer}, got ${details.buyer}`,
          details
        };
      }

      if (details.recipient.toLowerCase() !== expectedDetails.recipient.toLowerCase()) {
        return {
          isValid: false,
          error: `Recipient mismatch: expected ${expectedDetails.recipient}, got ${details.recipient}`,
          details
        };
      }
    }

    return { isValid: true, details };
  } catch (error) {
    console.error('Error verifying transaction:', error);
    return { 
      isValid: false, 
      error: error instanceof Error ? error.message : 'Failed to verify transaction' 
    };
  }
}

export async function monitorTransaction(
  signature: string,
  onStatusUpdate: (status: TransactionStatus) => void,
  expectedDetails?: TransactionDetails
): Promise<boolean> {
  // Add defensive check for signature
  if (!signature || typeof signature !== 'string') {
    console.error('Invalid transaction signature:', signature);
    onStatusUpdate({
      processing: false,
      success: false,
      error: 'Invalid transaction signature',
      paymentConfirmed: false
    });
    return false;
  }

  // Skip monitoring for non-Solana transactions (e.g. Stripe or free orders)
  if (signature.startsWith('pi_') || signature.startsWith('free_')) {
    console.log('Non-Solana transaction, skipping monitoring:', signature);
    onStatusUpdate({
      processing: false,
      success: true,
      paymentConfirmed: true,
      signature,
      error: null
    });
    return true;
  }

  // Prevent duplicate processing
  if (processedSignatures.has(signature)) {
    console.log('Transaction already processed:', signature);
    return true;
  }
  processedSignatures.add(signature);

  let attempts = 0;
  const toastId = toast.loading('Processing transaction...');

  try {
    // Initial processing status
    onStatusUpdate({
      processing: true,
      success: false,
      error: null,
      signature
    });

    // Initial delay to allow transaction to propagate
    await new Promise(resolve => setTimeout(resolve, 1000));

    while (attempts < MAX_RETRIES) {
      try {
        // Check transaction status
        const statuses = await SOLANA_CONNECTION.getSignatureStatuses([signature], {
          searchTransactionHistory: true
        });
        
        const status = statuses.value?.[0];
        console.log(`Status check ${attempts + 1}:`, status);

        if (status?.confirmationStatus === 'finalized') {
          // Verify transaction details
          const verification = await verifyTransactionDetails(signature, expectedDetails);

          if (!verification.isValid) {
            const errorMessage = verification.error || 'Transaction verification failed';
            
            // Update transaction log with failure
            try {
              await supabase.rpc('update_transaction_status', {
                p_signature: signature,
                p_status: 'failed',
                p_details: {
                  error: errorMessage,
                  verification: verification.details || null,
                  attempts: attempts + 1
                }
              });
              console.log('Transaction status updated to failed:', errorMessage);
            } catch (updateError) {
              console.error('Failed to update transaction status:', updateError);
            }

            toast.update(toastId, {
              render: errorMessage,
              type: 'error',
              isLoading: false,
              autoClose: 5000
            });

            onStatusUpdate({
              processing: false,
              success: false,
              error: errorMessage,
              signature,
              paymentConfirmed: false
            });

            return false;
          }

          // Update transaction log with success
          try {
            await supabase.rpc('update_transaction_status', {
              p_signature: signature,
              p_status: 'confirmed',
              p_details: {
                ...verification.details,
                confirmationAttempts: attempts + 1,
                confirmedAt: new Date().toISOString()
              }
            });
            console.log('Transaction status updated to confirmed');
            
            // Get order status for the transaction
            const { data: orders, error: orderError } = await supabase
              .from('orders')
              .select('id, status')
              .eq('transaction_signature', signature)
              .in('status', ['pending_payment', 'confirmed']);

            if (orderError) {
              console.error('Failed to get order for transaction:', orderError);
              // Continue since transaction was confirmed
            } else if (orders && orders.length > 0) {
              // Handle case where there might be multiple orders (shouldn't happen, but let's be safe)
              const order = orders[0];
              
              // Only attempt to confirm if the order is in pending_payment status
              if (order.status === 'pending_payment') {
                // Update order with transaction confirmation
                try {
                  const { error: confirmError } = await supabase.rpc('confirm_order_transaction', {
                    p_order_id: order.id
                  });

                  if (confirmError) {
                    console.error('Failed to confirm order transaction:', confirmError);
                    // If the error is because the order is already confirmed, that's okay
                    if (confirmError.message.includes('not in pending_payment status')) {
                      console.log('Order is already confirmed through another process');
                    } else {
                      // For other errors, we should retry once more directly
                      try {
                        const { error: retryError } = await supabase
                          .from('orders')
                          .update({ 
                            status: 'confirmed',
                            payment_confirmed_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                          })
                          .eq('id', order.id)
                          .eq('status', 'pending_payment');
                          
                        if (retryError) {
                          console.error('Retry update failed:', retryError);
                          toast.warning(
                            'Payment confirmed, but there was an issue updating the order. Please contact support.',
                            { autoClose: false }
                          );
                        } else {
                          console.log('Order confirmed via direct update');
                        }
                      } catch (retryError) {
                        console.error('Exception in retry update:', retryError);
                        toast.warning(
                          'Payment confirmed, but there was an issue updating the order. Please contact support.',
                          { autoClose: false }
                        );
                      }
                    }
                  } else {
                    console.log('Order confirmed successfully:', order.id);
                  }
                } catch (confirmError) {
                  console.error('Error confirming order transaction:', confirmError);
                  // Continue since transaction was confirmed
                }
              } else {
                console.log('Order is already confirmed:', order.id);
              }
            } else {
              console.log('No order found for transaction, logging for recovery check');
              // Only log creation attempt if no order exists
              try {
                const { error: logError } = await supabase.rpc('log_order_creation_attempt', {
                  p_signature: signature
                });
                
                if (logError) {
                  console.warn('Failed to log order creation attempt:', logError);
                } else {
                  console.log('Order creation attempt logged successfully');
                }
              } catch (logError) {
                console.warn('Exception logging order creation attempt:', logError);
              }
            }
          } catch (updateError) {
            console.error('Failed to update transaction status:', updateError);
            toast.warning(
              'Payment confirmed, but there was an issue recording it. Please contact support with your transaction ID.',
              { autoClose: false }
            );
            
            onStatusUpdate({
              processing: false,
              success: true,
              paymentConfirmed: true,
              error: 'Payment confirmed, but there was an issue recording it. Please contact support.',
              signature
            });
            
            return true;
          }

          const solscanUrl = `https://solscan.io/tx/${signature}`;
          toast.update(toastId, {
            render: () => (
              <div>
                Transaction confirmed!{' '}
                <a 
                  href={solscanUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-blue-400 hover:text-blue-300 underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  View on Solscan
                </a>
              </div>
            ),
            type: 'success',
            isLoading: false,
            autoClose: 8000
          });

          onStatusUpdate({
            processing: false,
            success: true,
            error: null,
            signature,
            paymentConfirmed: true
          });
          return true;
        }

        attempts++;
        const delay = Math.min(
          INITIAL_DELAY * Math.pow(1.5, attempts) + Math.random() * 1000,
          10000
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      } catch (error) {
        console.error(`Error checking transaction status (attempt ${attempts + 1}):`, error);
        
        // Update transaction log with error
        await supabase.rpc('update_transaction_status', {
          p_signature: signature,
          p_status: 'failed',
          p_details: {
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        });

        if (attempts === MAX_RETRIES - 1) {
          throw error;
        }

        attempts++;
        const delay = Math.min(
          INITIAL_DELAY * Math.pow(1.5, attempts) + Math.random() * 1000,
          10000
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    const timeoutError = 'Transaction confirmation timed out';
    toast.update(toastId, {
      render: timeoutError,
      type: 'error',
      isLoading: false,
      autoClose: 5000
    });

    onStatusUpdate({
      processing: false,
      success: false,
      error: timeoutError,
      signature
    });

    return false;
  } catch (error) {
    console.error('Transaction monitoring error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to monitor transaction';
    
    toast.update(toastId, {
      render: errorMessage,
      type: 'error',
      isLoading: false,
      autoClose: 5000
    });

    onStatusUpdate({
      processing: false,
      success: false,
      error: errorMessage,
      signature
    });

    return false;
  }
}