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
        // Check transaction status on Solana network first to avoid unnecessary server calls
        const statuses = await SOLANA_CONNECTION.getSignatureStatuses([signature], {
          searchTransactionHistory: true
        });
        
        const status = statuses.value?.[0];
        console.log(`Status check ${attempts + 1}:`, status);

        if (status?.confirmationStatus === 'finalized') {
          // Get auth token for API call
          let authToken = '';
          try {
            const { data } = await supabase.auth.getSession();
            authToken = data.session?.access_token || '';
          } catch (error) {
            console.warn('Failed to get auth session:', error);
            // Continue without auth token
          }
          
          // Instead of verifying on client, call server-side verification
          try {
            const response = await fetch('/.netlify/functions/verify-transaction', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
              },
              body: JSON.stringify({
                signature,
                expectedDetails,
                orderId: null  // Will be set if we know the order ID
              })
            });
            
            // Handle server errors or unavailability
            if (!response.ok) {
              // If server returns 502 Bad Gateway, the function is not available
              if (response.status === 502 || response.status === 401 || response.status === 403) {
                console.warn(`Server-side verification unavailable (${response.status}), falling back to blockchain confirmation only`);
                
                // Attempt to manually update transaction status
                try {
                  console.log('Attempting to update transaction status (attempt 1/5)');
                  const { error } = await supabase.rpc('update_transaction_status', {
                    p_signature: signature,
                    p_status: 'confirmed',
                    p_details: {
                      confirmedAt: new Date().toISOString(),
                      manuallyConfirmed: true,
                      clientConfirmed: true
                    }
                  });
                  
                  if (error) {
                    console.error('Failed to update transaction status:', error);
                  } else {
                    console.log('Transaction status updated successfully');
                  }
                } catch (dbError) {
                  console.error('Error updating transaction status:', dbError);
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

            // Get order status for the transaction to check if we need to update it
            const { data: orders, error: orderError } = await supabase
              .from('orders')
              .select('id, status')
              .eq('transaction_signature', signature)
              .in('status', ['pending_payment', 'confirmed']);

            if (!orderError && orders && orders.length > 0) {
              const order = orders[0];
              
              // Only send order ID for confirmation if still in pending_payment status
              if (order.status === 'pending_payment') {
                // Make another call to server to confirm the order
                const confirmResponse = await fetch('/.netlify/functions/verify-transaction', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                  },
                  body: JSON.stringify({
                    signature,
                    orderId: order.id
                  })
                });
                
                if (!confirmResponse.ok) {
                  const errorData = await confirmResponse.json().catch(() => ({ error: 'Failed to confirm order on server' }));
                  console.error('Failed to confirm order on server:', errorData);
                  // Continue anyway since the transaction is valid
                }
              }
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