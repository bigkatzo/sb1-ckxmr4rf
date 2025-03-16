import { SOLANA_CONNECTION } from '../config/solana';
import { toast } from 'react-toastify';
import { supabase } from '../lib/supabase';

interface TransactionStatus {
  processing: boolean;
  success: boolean;
  error: string | null;
  signature?: string;
  paymentConfirmed?: boolean;
}

const MAX_RETRIES = 30;
const INITIAL_DELAY = 1000;
const ALCHEMY_RPC_URL = `https://solana-mainnet.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_API_KEY}`;
const LAMPORTS_PER_SOL = 1_000_000_000;

export async function monitorTransaction(
  signature: string,
  onStatusUpdate: (status: TransactionStatus) => void
): Promise<boolean> {
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
        const response = await fetch(ALCHEMY_RPC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getSignatureStatuses',
            params: [[signature], { searchTransactionHistory: true }]
          })
        });

        const data = await response.json();
        
        if (data.error) {
          throw new Error(data.error.message);
        }

        const status = data.result?.value?.[0];
        console.log(`Status check ${attempts + 1}:`, status);

        if (status?.confirmationStatus === 'finalized') {
          if (status.err) {
            const errorMessage = 'Transaction failed on chain';
            
            // Update transaction log with failure
            try {
              await supabase.rpc('update_transaction_status', {
                p_signature: signature,
                p_status: 'failed',
                p_error_message: errorMessage
              });
              console.log('Transaction status updated to failed');
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
              signature
            });
            return false;
          }

          const txInfo = await SOLANA_CONNECTION.getTransaction(signature, {
            maxSupportedTransactionVersion: 0,
            commitment: 'finalized'
          });

          if (!txInfo || txInfo.meta?.err) {
            const errorMessage = 'Transaction verification failed';
            
            // Update transaction log with failure
            try {
              await supabase.rpc('update_transaction_status', {
                p_signature: signature,
                p_status: 'failed',
                p_error_message: errorMessage
              });
              console.log('Transaction status updated to failed (verification failed)');
            } catch (updateError) {
              console.error('Failed to update transaction status:', updateError);
            }

            throw new Error(errorMessage);
          }

          // Update transaction log with success
          try {
            await supabase.rpc('update_transaction_status', {
              p_signature: signature,
              p_status: 'confirmed'
            });
            console.log('Transaction status updated to confirmed');
            
            // Log a transaction for order creation monitoring
            try {
              const { error: logError } = await supabase.rpc('log_order_creation_attempt', {
                p_signature: signature
              });
              
              if (logError) {
                console.warn('Failed to log order creation attempt:', logError);
              }
            } catch (logError) {
              console.warn('Failed to log order creation attempt:', logError);
            }
          } catch (updateError) {
            console.error('Failed to update transaction status to confirmed:', updateError);
            
            // Even if we can't update the status, the payment was successful
            // We should mark this as a special case where payment succeeded but order might not be created
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
            
            // Still return true since payment was successful
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
          p_error_message: error instanceof Error ? error.message : 'Unknown error'
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
    
    // Update transaction log with timeout
    await supabase.rpc('update_transaction_status', {
      p_signature: signature,
      p_status: 'failed',
      p_error_message: timeoutError
    });

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
    
    // Update transaction log with error
    await supabase.rpc('update_transaction_status', {
      p_signature: signature,
      p_status: 'failed',
      p_error_message: errorMessage
    });

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