import { SOLANA_CONNECTION } from '../config/solana';
import { toast } from 'react-toastify';

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
 */
export async function monitorTransaction(
  signature: string,
  onStatusUpdate: (status: TransactionStatus) => void,
  expectedDetails?: TransactionDetails,
  orderId?: string // Order ID to link transaction to
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
  console.log('Starting transaction monitoring with params:', { 
    signature: signature.substring(0, 10) + '...',
    hasExpectedDetails: !!expectedDetails,
    orderId: orderId || 'none'
  });

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
        // Check if transaction is finalized on Solana blockchain
        const statuses = await SOLANA_CONNECTION.getSignatureStatuses([signature], {
          searchTransactionHistory: true
        });
        
        const status = statuses.value?.[0];
        console.log(`Status check ${attempts + 1}:`, status);

        // Only proceed with server verification if transaction is finalized
        if (status?.confirmationStatus === 'finalized') {
          try {
            // No auth token needed for server-side operations
            console.log('Transaction finalized on blockchain, sending to server for verification');

            // Send transaction to server for verification - ALL verification happens server-side
            const response = await fetch('/.netlify/functions/verify-transaction', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                signature,
                expectedDetails,
                orderId
              })
            });
            
            // Handle server response
            if (!response.ok) {
              // Server unavailable - background job will process it later
              if (response.status === 502 || response.status === 401 || response.status === 403) {
                console.warn(`Server temporarily unavailable (${response.status}). Verification will be completed by background job.`);
                
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
              const errorData = await response.json().catch(() => ({ error: 'Failed to verify transaction' }));
              throw new Error(errorData.error || 'Server verification failed');
            }
            
            // Process successful server response
            const verificationResult = await response.json();
            
            // Handle temporary approval
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
            
            // Handle verification failure
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

            // Success - transaction verified by server
            console.log('Server verification successful:', verificationResult);
            
            // Force immediate callback execution for UI updates
            try {
              console.log('Immediately executing success callback with paymentConfirmed=true');
              // Call onStatusUpdate immediately with paymentConfirmed true
              // This ensures the UI gets updated as soon as possible
              onStatusUpdate({
                processing: false,
                success: true,
                error: null,
                signature,
                paymentConfirmed: true
              });
            } catch (callbackError) {
              console.error('Error in immediate callback execution:', callbackError);
            }

            // Then show the toast
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

            // Add redundant onStatusUpdate calls to ensure the callback gets triggered
            // Use multiple timeouts with different delays for redundancy
            setTimeout(() => {
              console.log('Sending delayed confirmation callback (250ms)');
              try {
                onStatusUpdate({
                  processing: false,
                  success: true,
                  error: null,
                  signature,
                  paymentConfirmed: true
                });
              } catch (e) {
                console.error('Error in delayed callback (250ms):', e);
              }
            }, 250);

            setTimeout(() => {
              console.log('Sending delayed confirmation callback (1000ms)');
              try {
                onStatusUpdate({
                  processing: false,
                  success: true,
                  error: null,
                  signature,
                  paymentConfirmed: true
                });
              } catch (e) {
                console.error('Error in delayed callback (1000ms):', e);
              }
            }, 1000);

            return true;
          } catch (error) {
            console.error('Server verification error:', error);
            
            // Even if server verification fails, the transaction itself is confirmed
            // The background job will process it later
            console.warn('Transaction confirmed on blockchain but server verification failed. Will be processed automatically later.');
            
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

        // Transaction not finalized yet, continue checking
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

    // Max retries reached
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