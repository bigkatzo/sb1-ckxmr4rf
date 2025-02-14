import { useState } from 'react';
import { Transaction, PublicKey } from '@solana/web3.js';
import { useWallet } from '../contexts/WalletContext';
import { prepareTransaction, confirmTransactionWithRetry } from '../utils/transaction';

interface TransactionStatus {
  processing: boolean;
  success: boolean;
  error: string | null;
  signature: string | null;
}

export function useTransaction() {
  const { walletAddress } = useWallet();
  const [status, setStatus] = useState<TransactionStatus>({
    processing: false,
    success: false,
    error: null,
    signature: null
  });

  const resetStatus = () => {
    setStatus({
      processing: false,
      success: false,
      error: null,
      signature: null
    });
  };

  const sendTransaction = async (transaction: Transaction): Promise<boolean> => {
    if (!walletAddress || !window.solana) {
      setStatus({
        processing: false,
        success: false,
        error: 'Wallet not connected',
        signature: null
      });
      return false;
    }

    try {
      setStatus({ processing: true, success: false, error: null, signature: null });

      // Prepare transaction with latest blockhash
      const preparedTx = await prepareTransaction(
        transaction,
        new PublicKey(walletAddress)
      );

      // Sign and send transaction
      const { signature } = await window.solana.signAndSendTransaction(preparedTx);
      
      // Wait for confirmation
      const success = await confirmTransactionWithRetry(signature);

      setStatus({
        processing: false,
        success,
        error: success ? null : 'Transaction failed to confirm',
        signature: success ? signature : null
      });

      return success;
    } catch (error) {
      console.error('Transaction error:', error);
      
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Transaction failed';

      setStatus({
        processing: false,
        success: false,
        error: errorMessage,
        signature: null
      });
      
      return false;
    }
  };

  return {
    sendTransaction,
    status,
    resetStatus
  };
}