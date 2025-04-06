import { useEffect } from 'react';
import { Check, AlertCircle, ExternalLink, Wallet } from 'lucide-react';
import { getTransactionUrl, isStripeReceiptUrl } from '../../utils/transactions';

interface TransactionStatusProps {
  processing: boolean;
  success: boolean;
  error: string | null;
  signature?: string | null;
  onClose: () => void;
}

export function TransactionStatus({ 
  processing, 
  success, 
  error, 
  signature, 
  onClose 
}: TransactionStatusProps) {
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(onClose, 10000);
      return () => clearTimeout(timer);
    }
  }, [success, error, onClose]);

  if (!processing && !success && !error) return null;

  const isInsufficientBalance = error?.toLowerCase().includes('insufficient balance');
  const errorMessage = isInsufficientBalance 
    ? error 
    : (error || (processing ? 'Please wait while we process your transaction...' : 'Your transaction has been sent to the Solana network.'));

  return (
    <div className="max-w-[90vw] sm:max-w-md w-full">
      <div className={`
        flex flex-col gap-3 p-4 rounded-lg shadow-lg backdrop-blur-sm
        ${processing ? 'bg-blue-500/90' : success ? 'bg-green-500/90' : 'bg-red-500/90'}
        transition-colors duration-200
      `}>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            {success ? (
              <Check className="h-5 w-5" />
            ) : isInsufficientBalance ? (
              <Wallet className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium break-words">
              {processing ? 'Processing Transaction' : 
               success ? 'Transaction Sent' : 
               isInsufficientBalance ? 'Insufficient Balance' : 
               'Transaction Failed'}
            </h3>
            <p className="text-xs mt-1 opacity-90 break-words">
              {errorMessage}
            </p>
            {signature && (
              <div className="mt-2 flex flex-col gap-1">
                <p className="text-xs opacity-90">
                  {isStripeReceiptUrl(signature) ? 'Payment Receipt:' : 'Transaction ID:'}
                </p>
                {isStripeReceiptUrl(signature) ? (
                  <a
                    href={getTransactionUrl(signature)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs mt-1 hover:underline"
                  >
                    <span>View Receipt</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <>
                    <code className="text-xs bg-black/20 px-2 py-1 rounded break-all font-mono">
                      {signature}
                    </code>
                    <a
                      href={getTransactionUrl(signature)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs mt-2 hover:underline"
                    >
                      <span>View on Solscan</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </>
                )}
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="flex-shrink-0 text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <span className="sr-only">Close</span>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}