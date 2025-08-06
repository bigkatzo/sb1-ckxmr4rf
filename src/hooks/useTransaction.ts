import { useState, useCallback } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { Transaction, PublicKey, Connection } from '@solana/web3.js';
import { SOLANA_CONNECTION } from '../config/solana';

interface TransactionStatus {
  processing: boolean;
  success: boolean;
  error: string | null;
  signature: string | null;
}

interface TransactionResult {
  success: boolean;
  signature?: string;
  error?: string;
}

export function useTransaction() {
  const { walletAddress, isConnected, signAndSendTransaction, ensureAuthenticated } = useWallet();
  const [status, setStatus] = useState<TransactionStatus>({
    processing: false,
    success: false,
    error: null,
    signature: null
  });

  const validateWalletConnection = useCallback((): boolean => {
    if (!isConnected || !walletAddress) {
      setStatus({
        processing: false,
        success: false,
        error: 'Wallet not connected',
        signature: null
      });
      return false;
    }
    return true;
  }, [isConnected, walletAddress]);

  const handleTransactionError = useCallback((error: any): TransactionResult => {
    console.error('Transaction error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Transaction failed';
    
    setStatus({
      processing: false,
      success: false,
      error: errorMessage,
      signature: null
    });
    
    return { success: false, error: errorMessage };
  }, []);

  const monitorTransaction = useCallback(async (
    signature: string, 
    onStatusUpdate?: (status: TransactionStatus) => void
  ): Promise<boolean> => {
    try {
      const connection = new Connection(SOLANA_CONNECTION.rpcEndpoint);
      
      // Wait for finalization with timeout
      const confirmation = await connection.confirmTransaction(signature, 'finalized');
      
      const success = !confirmation.value.err;
      
      const newStatus: TransactionStatus = {
        processing: false,
        success,
        error: success ? null : 'Transaction failed to finalize',
        signature: success ? signature : null
      };
      
      setStatus(newStatus);
      onStatusUpdate?.(newStatus);
      
      return success;
    } catch (error) {
      console.error('Error monitoring transaction:', error);
      const newStatus: TransactionStatus = {
        processing: false,
        success: false,
        error: 'Failed to finalize transaction',
        signature: null
      };
      
      setStatus(newStatus);
      onStatusUpdate?.(newStatus);
      
      return false;
    }
  }, []);

  const sendTransaction = useCallback(async (
    transaction: Transaction
  ): Promise<TransactionResult> => {
    if (!validateWalletConnection()) {
      return { success: false, error: 'Wallet not connected' };
    }

    try {
      await ensureAuthenticated();
      setStatus({ processing: true, success: false, error: null, signature: null });

      // Sign and send transaction using Privy
      const signature = await signAndSendTransaction(transaction);
      console.log("✅ Transaction sent successfully:", signature);
      
      // Monitor transaction status
      const success = await monitorTransaction(signature, (status) => {
        setStatus(status);
      });

      return { success, signature };

    } catch (error) {
      return handleTransactionError(error);
    }
  }, [validateWalletConnection, ensureAuthenticated, signAndSendTransaction, monitorTransaction, handleTransactionError]);

  const resetStatus = useCallback(() => {
    setStatus({
      processing: false,
      success: false,
      error: null,
      signature: null
    });
  }, []);

  return {
    sendTransaction,
    status,
    resetStatus,
    isConnected,
    walletAddress
  };
}