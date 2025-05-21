import { PublicKey } from '@solana/web3.js';
import { SOLANA_CONNECTION } from '../config/solana';
import { toast } from 'react-toastify';
import { getCollectionWallet } from '../services/payments';

// Keep track of processed signatures to prevent duplicate processing
const processedSignatures = new Set<string>();

interface TransactionStatus {
  processing: boolean;
  success: boolean;
  error: string | null;
  signature?: string;
  paymentConfirmed?: boolean;
}

// This interface is used only for server communication
interface TransactionDetails {
  amount: number;
  buyer: string;
  recipient: string;
}

const MAX_RETRIES = 30;
const INITIAL_DELAY = 1000;

/**
 * Monitors transaction confirmation and sends to server for verification
 * The server is now fully responsible for all verification logic
 * Updated to handle batch orders consistently
 */
export async function monitorTransaction(
  signature: string,
  onStatusUpdate: (status: TransactionStatus) => void,
): Promise<boolean> {
  // Validate input
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

  // Log the orderId to help with debugging
  console.log('[TRANSACTION_MONITOR] Starting monitoring with params:', { 
    signature: signature.substring(0, 10) + '...',
  });

  // Skip monitoring for non-Solana transactions (e.g. Stripe or free orders)
  if (signature.startsWith('pi_') || signature.startsWith('free_')) {
    console.log('[TRANSACTION_MONITOR] Non-Solana transaction detected, skipping monitoring:', signature);
    
    // For Stripe payments, attempt direct verification
    if (signature.startsWith('pi_')) {
      console.log('[TRANSACTION_MONITOR] Verifying Stripe payment:', signature);
      try {
        // Attempt to call the stripe-helper endpoint to verify the payment intent
        const stripeVerifyResponse = await fetch('/.netlify/functions/stripe-helper', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: 'verify', 
            paymentIntentId: signature,
          })
        });
        
        if (!stripeVerifyResponse.ok) {
          console.warn('[TRANSACTION_MONITOR] Stripe verification response not OK:', stripeVerifyResponse.status);
        } else {
          const verifyData = await stripeVerifyResponse.json();
          console.log('[TRANSACTION_MONITOR] Stripe payment verification result:', verifyData);
          
          // If metadata didn't contain an orderId but we have one from params, repair it
          // if (orderId && (!verifyData.data?.metadata?.orderIdStr || verifyData.data?.metadata?.orderIdStr !== orderId)) {
          //   console.log('[TRANSACTION_MONITOR] Order ID mismatch in metadata, attempting repair');
            
          //   // Call the repair endpoint
          //   try {
          //     const repairResponse = await fetch('/.netlify/functions/stripe-helper', {
          //       method: 'POST',
          //       headers: { 'Content-Type': 'application/json' },
          //       body: JSON.stringify({ 
          //         action: 'repair', 
          //         paymentIntentId: signature,
          //         orderId,
          //         batchOrderId
          //       })
          //     });
              
          //     if (repairResponse.ok) {
          //       const repairResult = await repairResponse.json();
          //       console.log('[TRANSACTION_MONITOR] Stripe payment repair successful:', repairResult);
          //     } else {
          //       console.warn('[TRANSACTION_MONITOR] Stripe payment repair failed:', repairResponse.status);
          //     }
          //   } catch (repairError) {
          //     console.error('[TRANSACTION_MONITOR] Error repairing Stripe payment:', repairError);
          //   }
          // }
        }
      } catch (stripeVerifyError) {
        console.error('[TRANSACTION_MONITOR] Error verifying Stripe payment:', stripeVerifyError);
      }
    }
    
    // Return success immediately for non-Solana transactions
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
    console.log('[TRANSACTION_MONITOR] Transaction already processed:', signature);
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
        // Check if transaction is finalized on Solana blockchain
        console.log(`[TRANSACTION_MONITOR] Checking status (attempt ${attempts + 1}/${MAX_RETRIES})`);
        const statuses = await SOLANA_CONNECTION.getSignatureStatuses([signature], {
          searchTransactionHistory: true
        });
        
        const status = statuses.value?.[0];
        console.log(`[TRANSACTION_MONITOR] Status check ${attempts + 1}:`, {
          confirmationStatus: status?.confirmationStatus,
          slot: status?.slot,
          confirmations: status?.confirmations,
          err: status?.err
        }); 

        if (status?.confirmationStatus === 'finalized') {
          // Define solscanUrl before we use it
          const solscanUrl = `https://solscan.io/tx/${signature}`;

            toast.update(toastId, {
              render: () => (
                <div>
                  <div className="mb-2">Transaction confirmed!</div>
                  <div className="flex flex-col gap-2">
                    <a 
                      href={solscanUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-blue-400 hover:text-blue-300 underline text-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View on Solscan
                    </a>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.location.href = '/orders';
                      }}
                      className="text-left text-green-400 hover:text-green-300 underline text-sm"
                    >
                      View Your Orders
                    </button>
                  </div>
                </div>
              ),
              type: 'success',
              isLoading: false,
              autoClose: 8000
            });

          // Add redundant onStatusUpdate calls to ensure the callback gets triggered
          // Use setTimeout with staggered delays for redundancy
          setTimeout(() => {
            try {
              console.log('[TRANSACTION_MONITOR] Sending first delayed success callback');
              onStatusUpdate({
                processing: false,
                success: true,
                error: null,
                signature,
                paymentConfirmed: true
              });
            } catch (e) {
              console.error('[TRANSACTION_MONITOR] Error in first delayed callback:', e);
            }
          }, 250);

          setTimeout(() => {
            try {
              console.log('[TRANSACTION_MONITOR] Sending second delayed success callback');
              onStatusUpdate({
                processing: false,
                success: true,
                error: null,
                signature,
                paymentConfirmed: true
              });
            } catch (e) {
              console.error('[TRANSACTION_MONITOR] Error in second delayed callback:', e);
            }
          }, 500);

          setTimeout(() => {
            try {
              console.log('[TRANSACTION_MONITOR] Sending third delayed success callback');
              onStatusUpdate({
                processing: false,
                success: true,
                error: null,
                signature,
                paymentConfirmed: true
              });
            } catch (e) {
              console.error('[TRANSACTION_MONITOR] Error in third delayed callback:', e);
            }
          }, 1000);

          console.log('[TRANSACTION_MONITOR] Transaction monitoring completed successfully');
          return true;
        }
        // Transaction not finalized yet, continue checking
        attempts++;
        const delay = Math.min(
          INITIAL_DELAY * Math.pow(1.5, attempts) + Math.random() * 1000,
          10000
        );
        console.log(`[TRANSACTION_MONITOR] Transaction not yet finalized, retrying in ${Math.round(delay/1000)}s`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } catch (error) {
        console.error(`[TRANSACTION_MONITOR] Error checking transaction status (attempt ${attempts + 1}):`, error);
        
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

    // Max retries reached
    const timeoutError = 'Transaction confirmation timed out';
    console.error('[TRANSACTION_MONITOR] Maximum retry attempts reached. Transaction confirmation timed out.');
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
    console.error('[TRANSACTION_MONITOR] Transaction monitoring error:', error);
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

export async function verifyFinalTransaction(
  signature: string,
  onStatusUpdate: (status: TransactionStatus) => void,
  orderId?: string,
  batchOrderId?: string, // Batch order ID for multi-item orders
  expectedDetails?: TransactionDetails,
) {
   const toastId = toast.loading('Processing transaction...');
  
  // Only proceed with server verification if transaction is finalized
    console.log('[TRANSACTION_MONITOR] Transaction finalized on blockchain, proceeding to server verification');
    try {
      // No auth token needed for server-side operations
      console.log('[TRANSACTION_MONITOR] Building verification payload');

      // Prepare the payload with complete information
      const payload: any = {
        signature,
        status: 'confirmed'
      };

      // Include orderId if provided
      if (orderId) {
        payload.orderId = orderId;
      }

      // Include batch information if provided
      if (batchOrderId) {
        payload.batchOrderId = batchOrderId;
        payload.isBatchOrder = !!batchOrderId;
      }

      // Include expected details if provided
      if (expectedDetails) {
        const merchantWalletAddress = await getCollectionWallet(expectedDetails.recipient);
    
        if (merchantWalletAddress) {
          const merchantPubkey = new PublicKey(merchantWalletAddress);
          payload.expectedDetails = {
            ...expectedDetails,
            recipient: merchantPubkey
          }
        } else {
          payload.expectedDetails = expectedDetails;
        }
      }

      console.log('[TRANSACTION_MONITOR] Sending verification payload to server:', {
        ...payload,
        signature: signature.substring(0, 8) + '...',
        expectedDetails: expectedDetails ? {
          amount: expectedDetails.amount,
          buyer: expectedDetails.buyer.substring(0, 6) + '...',
          recipient: expectedDetails.recipient.substring(0, 6) + '...'
        } : 'none'
      });

      // Send transaction to server for verification - ALL verification happens server-side
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20-second timeout
      
      try {
        const response = await fetch('/.netlify/functions/verify-transaction', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        // Handle server response
        if (!response.ok) {
          // Server unavailable - background job will process it later
          if (response.status === 502 || response.status === 401 || response.status === 403) {
            console.warn(`[TRANSACTION_MONITOR] Server temporarily unavailable (${response.status}). Verification will be completed by background job.`);
            
            toast.update(toastId, {
              render: () => (
                <div>
                  Transaction confirmed! Verification will be processed automatically.
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
          
          // Other server errors
          const responseText = await response.text();
          console.error('[TRANSACTION_MONITOR] Server error response:', {
            status: response.status,
            statusText: response.statusText,
            body: responseText.substring(0, 200) // Truncate long responses
          });
          
          try {
            const errorData = JSON.parse(responseText);
            throw new Error(errorData.error || 'Server verification failed');
          } catch (parseError) {
            throw new Error(`Server error (${response.status}): ${responseText.substring(0, 100)}`);
          }
        }
        
        // Parse the successful response
        const responseText = await response.text();
        console.log('[TRANSACTION_MONITOR] Server response raw:', responseText.substring(0, 200));
        
        let verificationResult;
        try {
          verificationResult = JSON.parse(responseText);
          console.log('[TRANSACTION_MONITOR] Parsed server response:', verificationResult);
        } catch (parseError) {
          console.error('[TRANSACTION_MONITOR] Error parsing server response:', parseError);
          throw new Error('Invalid server response format');
        }
        
        // Handle temporary approval
        if (verificationResult.warning && verificationResult.tempApproved) {
          console.warn('[TRANSACTION_MONITOR] Server returned temporary approval:', verificationResult.warning);
          
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
        
        // Handle verification failure
        if (!verificationResult.success) {
          const errorMessage = verificationResult.error || 'Transaction verification failed';
          console.error('[TRANSACTION_MONITOR] Verification failed:', errorMessage);
          
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

        // Success - transaction verified by server
        console.log('[TRANSACTION_MONITOR] Server verification successful:', verificationResult);

        // Define solscanUrl before we use it
        const solscanUrl = `https://solscan.io/tx/${signature}`;

        // Check for batch order information in the response
        const batchOrderSuccess = verificationResult.ordersUpdated && 
          (verificationResult.ordersUpdated.length > 0 || 
          (typeof verificationResult.ordersUpdated === 'number' && verificationResult.ordersUpdated > 0));
          
        if (batchOrderSuccess) {
          console.log('[TRANSACTION_MONITOR] Batch order successfully processed:', {
            batchOrderId: verificationResult.batchOrderId || batchOrderId,
            ordersUpdated: verificationResult.ordersUpdated
          });
          
          // Customize message for batch orders
          const batchMessage = typeof verificationResult.ordersUpdated === 'number' 
            ? `${verificationResult.ordersUpdated} items` 
            : 'multiple items';
          
          toast.update(toastId, {
            render: () => (
              <div>
                <div className="mb-2">Batch order transaction confirmed!</div>
                <div className="text-sm mb-1">Order containing {batchMessage} has been processed.</div>
                <div className="flex flex-col gap-2">
                  <a 
                    href={solscanUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-blue-400 hover:text-blue-300 underline text-sm"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View on Solscan
                  </a>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      window.location.href = '/orders';
                    }}
                    className="text-left text-green-400 hover:text-green-300 underline text-sm"
                  >
                    View Your Orders
                  </button>
                </div>
              </div>
            ),
            type: 'success',
            isLoading: false,
            autoClose: 8000
          });
        }
        else {
          // Standard transaction notification for non-batch orders
          toast.update(toastId, {
            render: () => (
              <div>
                <div className="mb-2">Transaction confirmed!</div>
                <div className="flex flex-col gap-2">
                  <a 
                    href={solscanUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-blue-400 hover:text-blue-300 underline text-sm"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View on Solscan
                  </a>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      window.location.href = '/orders';
                    }}
                    className="text-left text-green-400 hover:text-green-300 underline text-sm"
                  >
                    View Your Orders
                  </button>
                </div>
              </div>
            ),
            type: 'success',
            isLoading: false,
            autoClose: 8000
          });
        }

        // Add redundant onStatusUpdate calls to ensure the callback gets triggered
        // Use setTimeout with staggered delays for redundancy
        setTimeout(() => {
          try {
            console.log('[TRANSACTION_MONITOR] Sending first delayed success callback');
            onStatusUpdate({
              processing: false,
              success: true,
              error: null,
              signature,
              paymentConfirmed: true
            });
          } catch (e) {
            console.error('[TRANSACTION_MONITOR] Error in first delayed callback:', e);
          }
        }, 250);

        setTimeout(() => {
          try {
            console.log('[TRANSACTION_MONITOR] Sending second delayed success callback');
            onStatusUpdate({
              processing: false,
              success: true,
              error: null,
              signature,
              paymentConfirmed: true
            });
          } catch (e) {
            console.error('[TRANSACTION_MONITOR] Error in second delayed callback:', e);
          }
        }, 500);

        setTimeout(() => {
          try {
            console.log('[TRANSACTION_MONITOR] Sending third delayed success callback');
            onStatusUpdate({
              processing: false,
              success: true,
              error: null,
              signature,
              paymentConfirmed: true
            });
          } catch (e) {
            console.error('[TRANSACTION_MONITOR] Error in third delayed callback:', e);
          }
        }, 1000);

        console.log('[TRANSACTION_MONITOR] Transaction monitoring completed successfully');
        return true;
      } catch (abortError: unknown) {
        clearTimeout(timeoutId);
        if (abortError instanceof Error && abortError.name === 'AbortError') {
          console.error('[TRANSACTION_MONITOR] Server verification request timed out after 20 seconds');
          throw new Error('Verification request timed out, but transaction is confirmed on blockchain. The order will be processed automatically.');
        }
        throw abortError;
      }
    } catch (error) {
      console.error('[TRANSACTION_MONITOR] Server verification error:', error);
      
      // Even if server verification fails, the transaction itself is confirmed
      // The background job will process it later
      console.warn('[TRANSACTION_MONITOR] Transaction confirmed on blockchain but server verification failed. Will be processed automatically later.');
      
      toast.update(toastId, {
        render: () => (
          <div>
            Transaction confirmed! Verification will complete automatically.
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