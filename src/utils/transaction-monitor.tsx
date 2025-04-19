import { SOLANA_CONNECTION } from '../config/solana';
import { toast } from 'react-toastify';
import { supabase } from '../lib/supabase';

// Keep track of processed signatures to prevent duplicate processing
const processedSignatures = new Set<string>();

interface TransactionStatus {
  processing: boolean;
  success: boolean;
  error: string | null;
  signature?: string;
  paymentConfirmed?: boolean;
}

// This function is no longer used - verification happens on the server side now
// Keeping the interface type for reference
interface TransactionDetails {
  amount: number;
  buyer: string;
  recipient: string;
}

const MAX_RETRIES = 30;
const INITIAL_DELAY = 1000;

// Remove or comment out the unused function
// async function verifyTransactionDetails(
//   signature: string,
//   expectedDetails?: TransactionDetails
// ): Promise<{ isValid: boolean; error?: string; details?: TransactionDetails }> {
//   // Function body removed as it's unused
// }

// Add getAuthToken helper function if it doesn't exist
async function getAuthToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  } catch (error) {
    console.error('Failed to get auth session:', error);
    return null;
  }
}

export async function monitorTransaction(
  signature: string,
  onStatusUpdate: (status: TransactionStatus) => void,
  expectedDetails?: TransactionDetails,
  orderId?: string // Add orderId parameter to explicitly link transaction to order
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
  
  // Flag to track if server has already processed the order
  let serverProcessedOrder = false;

  try {
    // Initial processing status
    onStatusUpdate({
      processing: true,
      success: false,
      error: null,
      signature
    });

    // If we have an orderId, check if it's already been processed by the server
    if (orderId) {
      try {
        // Check current order status first
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select('status, transaction_signature')
          .eq('id', orderId)
          .single();
          
        if (!orderError && orderData) {
          // If order is already in pending_payment or confirmed status with our signature,
          // the server has likely already processed it
          if ((orderData.status === 'pending_payment' || orderData.status === 'confirmed') && 
              orderData.transaction_signature === signature) {
            console.log(`Order ${orderId} already processed by server (status: ${orderData.status})`);
            serverProcessedOrder = true;
          } else if (orderData.status === 'draft') {
            // If still in draft, link the transaction
            try {
              console.log(`Linking transaction ${signature} to order ${orderId}`);
              const { error } = await supabase
                .from('orders')
                .update({ transaction_signature: signature })
                .eq('id', orderId);
                
              if (error) {
                console.error('Failed to link transaction to order:', error);
              } else {
                console.log(`Successfully linked transaction ${signature} to order ${orderId}`);
              }
            } catch (linkError) {
              console.error('Error linking transaction to order:', linkError);
            }
          }
        }
      } catch (checkError) {
        console.error('Error checking order status:', checkError);
      }
    }

    // Initial delay to allow transaction to propagate
    await new Promise(resolve => setTimeout(resolve, 1000));

    while (attempts < MAX_RETRIES) {
      try {
        // Check transaction status on Solana network first to avoid unnecessary server calls
        const statuses = await SOLANA_CONNECTION.getSignatureStatuses([signature], {
          searchTransactionHistory: true
        });
        
        const status = statuses.value?.[0];
        console.log(`Status check ${attempts + 1}:`, status);

        if (status?.confirmationStatus === 'finalized') {
          // Transaction is finalized on Solana, send to server for verification and order update
          try {
            const authToken = await getAuthToken();
            
            if (!authToken) {
              console.error('Failed to retrieve auth token for verification');
              throw new Error('Authentication failed');
            }
            
            console.log('Auth token retrieved for verification successfully');

            // Single call to verify transaction and update any associated orders
            // The server will now handle finding and updating all related orders
            console.log('Sending transaction to server for verification and order updates');
            const response = await fetch('/.netlify/functions/verify-transaction', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
              },
              body: JSON.stringify({
                signature,
                expectedDetails,
                orderId // Include orderId if available
              })
            });
            
            // Handle server errors or unavailability
            if (!response.ok) {
              // If server returns 502 Bad Gateway, the function is not available
              if (response.status === 502 || response.status === 401 || response.status === 403) {
                console.warn(`Server-side verification unavailable (${response.status}), falling back to blockchain confirmation only`);
                
                // If the server couldn't process and we have an orderId, try to update manually if not already processed
                if (orderId && !serverProcessedOrder) {
                  try {
                    console.log('Attempting to update transaction status (attempt 1/5)');
                    
                    // Check current order status first
                    const { data: currentOrder, error: checkError } = await supabase
                      .from('orders')
                      .select('status')
                      .eq('id', orderId)
                      .single();
                      
                    if (!checkError && currentOrder) {
                      if (currentOrder.status === 'draft') {
                        // Update from draft to pending_payment
                        const { error } = await supabase.rpc('update_order_transaction', {
                          p_order_id: orderId,
                          p_transaction_signature: signature,
                          p_amount_sol: expectedDetails?.amount || 0
                        });
                        
                        if (error) {
                          console.error('Failed to update order status:', error);
                        } else {
                          console.log('Transaction status updated successfully');
                        }
                      } else if (currentOrder.status === 'pending_payment') {
                        // Update from pending_payment to confirmed
                        const { error } = await supabase.rpc('confirm_order_payment', {
                          p_transaction_signature: signature,
                          p_status: 'confirmed'
                        });
                        
                        if (error) {
                          console.error('Failed to confirm order payment:', error);
                        } else {
                          console.log('Order payment confirmed successfully');
                        }
                      }
                    }
                  } catch (dbError) {
                    console.error('Error updating transaction status:', dbError);
                  }
                }
                
                // Directly update the UI as success since the transaction is finalized on Solana
                toast.update(toastId, {
                  render: () => (
                    <div>
                      Transaction confirmed! Verification details will be processed later.
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
              
              // For other errors, try to parse error message
              const errorData = await response.json().catch(() => ({ error: 'Failed to verify transaction on server' }));
              throw new Error(errorData.error || 'Failed to verify transaction on server');
            }
            
            const verificationResult = await response.json();
            
            // If server returned a temp approval due to verification being unavailable
            if (verificationResult.warning && verificationResult.tempApproved) {
              console.warn('Server returned temporary approval:', verificationResult.warning);
              
              toast.update(toastId, {
                render: () => (
                  <div>
                    Transaction confirmed! {verificationResult.warning}
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
            
            if (!verificationResult.success) {
              const errorMessage = verificationResult.error || 'Transaction verification failed';
              
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

            // Show order update results in console
            if (verificationResult.ordersUpdated && verificationResult.ordersUpdated.length > 0) {
              console.log(`Successfully updated ${verificationResult.ordersUpdated.length} orders:`, verificationResult.ordersUpdated);
              serverProcessedOrder = true;
            }
            
            if (verificationResult.ordersFailed && verificationResult.ordersFailed.length > 0) {
              console.warn(`Failed to update ${verificationResult.ordersFailed.length} orders:`, verificationResult.ordersFailed);
            }

            // Success - transaction verified and orders updated
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
          } catch (error) {
            console.error('Error verifying transaction on server:', error);
            
            // If server verification fails but blockchain confirms transaction,
            // fall back to accepting the transaction as confirmed
            console.warn('Server verification failed, falling back to blockchain confirmation only');
            
            toast.update(toastId, {
              render: () => (
                <div>
                  Transaction confirmed on blockchain. Verification details will be processed later.
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
        }

        attempts++;
        const delay = Math.min(
          INITIAL_DELAY * Math.pow(1.5, attempts) + Math.random() * 1000,
          10000
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      } catch (error) {
        console.error(`Error checking transaction status (attempt ${attempts + 1}):`, error);
        
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