import { SOLANA_CONNECTION } from '../config/solana';
import { toast } from 'react-toastify';

interface TransactionStatus {
  processing: boolean;
  success: boolean;
  error: string | null;
  signature?: string;
}

const MAX_RETRIES = 30;
const INITIAL_DELAY = 1000;
const ALCHEMY_RPC_URL = `https://solana-mainnet.g.alchemy.com/v2/${import.meta.env.VITE_ALCHEMY_API_KEY}`;

export async function monitorTransaction(
  signature: string,
  onStatusUpdate: (status: TransactionStatus) => void
): Promise<boolean> {
  let attempts = 0;
  let toastId: string | number = '';

  try {
    // Initial processing status
    onStatusUpdate({
      processing: true,
      success: false,
      error: null,
      signature
    });

    // Show initial toast
    toastId = toast.loading('Processing transaction...', {
      position: 'bottom-right',
      autoClose: false
    });

    // Wait 5 seconds before first check
    await new Promise(resolve => setTimeout(resolve, 5000));

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
            throw new Error('Transaction verification failed');
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
            signature
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
        
        if (attempts === MAX_RETRIES - 1) {
          const solscanUrl = `https://solscan.io/tx/${signature}`;
          toast.update(toastId, {
            render: () => (
              <div>
                Failed to confirm transaction.{' '}
                <a 
                  href={solscanUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-blue-400 hover:text-blue-300 underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  Check on Solscan
                </a>
              </div>
            ),
            type: 'error',
            isLoading: false,
            autoClose: 5000
          });
          onStatusUpdate({
            processing: false,
            success: false,
            error: 'Failed to confirm transaction. Please check Solscan for status.',
            signature
          });
          return false;
        }
        
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    const solscanUrl = `https://solscan.io/tx/${signature}`;
    toast.update(toastId, {
      render: () => (
        <div>
          Transaction confirmation timeout.{' '}
          <a 
            href={solscanUrl} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-blue-400 hover:text-blue-300 underline"
            onClick={(e) => e.stopPropagation()}
          >
            Check on Solscan
          </a>
        </div>
      ),
      type: 'error',
      isLoading: false,
      autoClose: 5000
    });
    onStatusUpdate({
      processing: false,
      success: false,
      error: 'Transaction confirmation timeout. Please check Solscan for final status.',
      signature
    });
    return false;
  } catch (error) {
    console.error('Error monitoring transaction:', error);
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