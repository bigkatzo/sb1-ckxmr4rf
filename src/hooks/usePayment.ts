import { useState, useCallback } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { createSolanaPayment } from '../services/payments';
import { monitorTransaction } from '../utils/transaction-monitor';
import { updateTransactionStatus } from '../services/orders';
import { toast } from 'react-toastify';

interface PaymentStatus {
  processing: boolean;
  success: boolean;
  error: string | null;
  signature?: string;
}

export function usePayment() {
  const { walletAddress, isConnected, signAndSendTransaction } = useWallet();
  const [status, setStatus] = useState<PaymentStatus>({
    processing: false,
    success: false,
    error: null
  });

  const resetStatus = useCallback(() => {
    setStatus({
      processing: false,
      success: false,
      error: null
    });
  }, []);

  const processPayment = async (amount: number, collectionId: string): Promise<{ success: boolean; signature?: string }> => {
    if (!isConnected || !walletAddress) {
      toast.error('Please connect your wallet first');
      setStatus({
        processing: false,
        success: false,
        error: 'Please connect your wallet first'
      });
      return { success: false };
    }

    try {
      setStatus({ processing: true, success: false, error: null });
      toast.info('Creating payment transaction...', { autoClose: 2000 });

      // Create transaction with collection ID
      const transaction = await createSolanaPayment(amount, walletAddress, collectionId);

      // Sign and send transaction
      const signature = await signAndSendTransaction(transaction);
      toast.info('Transaction sent! Confirming...', { autoClose: 3000 });

      // Monitor transaction status
      const success = await monitorTransaction(signature, async (status) => {
        setStatus(status);
        
        if (status.success) {
          await updateTransactionStatus(signature, 'confirmed');
          toast.success('Payment successful!', {
            autoClose: 5000,
            onClick: () => {
              window.open(`https://solscan.io/tx/${signature}`, '_blank');
            }
          });
        } else if (status.error) {
          await updateTransactionStatus(signature, 'failed');
          toast.error(status.error, { autoClose: 5000 });
        }
      });

      return { success, signature };
    } catch (error) {
      console.error('Payment error:', error);
      
      let errorMessage = 'Payment failed';
      if (error instanceof Error) {
        if (error.message.includes('Insufficient balance')) {
          const match = error.message.match(/Required: ([\d.]+) SOL/);
          const requiredAmount = match ? match[1] : null;
          errorMessage = requiredAmount 
            ? `Insufficient balance. Required: ${requiredAmount} SOL (including fees)`
            : 'Insufficient balance in your wallet';
        } else if (error.message.includes('User rejected')) {
          errorMessage = 'Transaction was rejected';
        } else {
          errorMessage = error.message;
        }
      }

      toast.error(errorMessage);
      setStatus({
        processing: false,
        success: false,
        error: errorMessage,
        signature: error instanceof Error && error.message.includes('signature:') 
          ? error.message.split('signature:')[1].trim()
          : undefined
      });
      
      return { success: false };
    }
  };

  return {
    processPayment,
    status,
    resetStatus
  };
}