import { useState, useCallback } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { Transaction, PublicKey, Connection } from '@solana/web3.js';
import { SOLANA_CONNECTION } from '../config/solana';

interface PaymentStatus {
  processing: boolean;
  success: boolean;
  error: string | null;
  signature: string | null;
}

interface PaymentResult {
  success: boolean;
  signature?: string;
  error?: string;
}

export function usePayment() {
  const { walletAddress, isConnected, signAndSendTransaction, ensureAuthenticated } = useWallet();
  const [status, setStatus] = useState<PaymentStatus>({
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

  const handlePaymentError = useCallback((error: any): PaymentResult => {
    console.error('Payment error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Payment failed';
    
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
    onStatusUpdate?: (status: PaymentStatus) => void
  ): Promise<boolean> => {
    try {
      const connection = new Connection(SOLANA_CONNECTION.rpcEndpoint);
      
      // Wait for confirmation with timeout
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');
      
      const success = !confirmation.value.err;
      
      const newStatus: PaymentStatus = {
        processing: false,
        success,
        error: success ? null : 'Transaction failed to confirm',
        signature: success ? signature : null
      };
      
      setStatus(newStatus);
      onStatusUpdate?.(newStatus);
      
      return success;
    } catch (error) {
      console.error('Error monitoring transaction:', error);
      const newStatus: PaymentStatus = {
        processing: false,
        success: false,
        error: 'Failed to confirm transaction',
        signature: null
      };
      
      setStatus(newStatus);
      onStatusUpdate?.(newStatus);
      
      return false;
    }
  }, []);

  const updateTransactionStatus = useCallback(async (signature: string, status: string) => {
    try {
      // Update transaction status in your backend/database
      console.log(`Transaction ${signature} status updated to: ${status}`);
    } catch (error) {
      console.error('Error updating transaction status:', error);
    }
  }, []);

  const createSolanaPayment = useCallback(async (
    amount: number, 
    fromAddress: string, 
    toAddress: string
  ): Promise<Transaction> => {
    const connection = new Connection(SOLANA_CONNECTION.rpcEndpoint);
    
    // Create a simple SOL transfer transaction
    const transaction = new Transaction().add(
      // Add transfer instruction here
      // This is a placeholder - you'll need to implement the actual transfer
    );
    
    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = new PublicKey(fromAddress);
    
    return transaction;
  }, []);

  const processTokenPayment = async (
    amount: number,
    orderId: string
  ): Promise<PaymentResult> => {
    if (!validateWalletConnection()) {
      return { success: false, error: 'Wallet not connected' };
    }

    try {
      await ensureAuthenticated();
      setStatus({ processing: true, success: false, error: null, signature: null });

      // Create token payment transaction
      const transaction = await createSolanaPayment(amount, walletAddress!, 'MERCHANT_WALLET_ADDRESS');
      console.log('✅ Token payment transaction created successfully');

      // Sign and send transaction using Privy
      const signature = await signAndSendTransaction(transaction);
      console.log("✅ Token payment transaction sent successfully:", signature);
      
      // Monitor transaction status
      const success = await monitorTransaction(signature, async (status) => {
        setStatus(status);
        
        if (status.success) {
          await updateTransactionStatus(signature, 'confirmed');
          // toast.success('Payment confirmed!');
        } else if (status.error) {
          await updateTransactionStatus(signature, 'failed');
        }
      });

      return { success, signature };

    } catch (error) {
      return handlePaymentError(error);
    }
  };

  const processPayment = async (
    amount: number, 
    orderId: string, 
    receiverWallet: string
  ): Promise<PaymentResult> => {
    if (!validateWalletConnection()) {
      return { success: false, error: 'Wallet not connected' };
    }

    try {
      await ensureAuthenticated();
      setStatus({ processing: true, success: false, error: null, signature: null });

      // Create SOL payment transaction
      const transaction = await createSolanaPayment(amount, walletAddress!, receiverWallet);
      console.log('✅ SOL payment transaction created successfully');

      // Sign and send transaction using Privy
      const signature = await signAndSendTransaction(transaction);
      console.log("✅ SOL payment transaction sent successfully:", signature);
      
      // Monitor transaction status
      const success = await monitorTransaction(signature, async (status) => {
        setStatus(status);
        
        if (status.success) {
          await updateTransactionStatus(signature, 'confirmed');
          // toast.success('Payment confirmed!');
        } else if (status.error) {
          await updateTransactionStatus(signature, 'failed');
        }
      });

      return { success, signature };

    } catch (error) {
      return handlePaymentError(error);
    }
  };

  const resetStatus = useCallback(() => {
    setStatus({
      processing: false,
      success: false,
      error: null,
      signature: null
    });
  }, []);

  return {
    processPayment,
    processTokenPayment,
    status,
    resetStatus,
    isConnected,
    walletAddress
  };
}