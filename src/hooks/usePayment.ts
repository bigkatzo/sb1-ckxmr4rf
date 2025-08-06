import { useState, useCallback } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { Transaction, PublicKey, Connection, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, createTransferInstruction, getAccount, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { SOLANA_CONNECTION } from '../config/solana';
import { tokenService } from '../services/tokenService';

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
      SystemProgram.transfer({
        fromPubkey: new PublicKey(fromAddress),
        toPubkey: new PublicKey(toAddress),
        lamports: amount * LAMPORTS_PER_SOL, // Convert amount to lamports
      })
    );
    
    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = new PublicKey(fromAddress);
    
    return transaction;
  }, []);

  const createTokenPayment = useCallback(async (
    amount: number, 
    fromAddress: string, 
    toAddress: string,
    tokenAddress: string
  ): Promise<Transaction> => {
    const connection = new Connection(SOLANA_CONNECTION.rpcEndpoint);
    
    // Get token info to determine decimals
    const tokenInfo = await tokenService.getTokenInfo(tokenAddress);
    const decimals = tokenInfo.decimals || 6; // Default to 6 decimals if not available
    
    // Convert amount to token's smallest unit
    const amountInSmallestUnit = Math.floor(amount * Math.pow(10, decimals));
    
    // Get associated token accounts
    const fromTokenAccount = getAssociatedTokenAddressSync(
      new PublicKey(tokenAddress),
      new PublicKey(fromAddress)
    );
    
    const toTokenAccount = getAssociatedTokenAddressSync(
      new PublicKey(tokenAddress),
      new PublicKey(toAddress)
    );
    
    // Check if token accounts exist
    const instructions = [];
    
    try {
      await getAccount(connection, toTokenAccount);
    } catch (error) {
      // Create associated token account for recipient if it doesn't exist
      instructions.push(
        createAssociatedTokenAccountInstruction(
          new PublicKey(fromAddress), // payer
          toTokenAccount, // associated token account
          new PublicKey(toAddress), // owner
          new PublicKey(tokenAddress) // mint
        )
      );
    }
    
    // Create SPL token transfer instruction
    instructions.push(
      createTransferInstruction(
        fromTokenAccount,
        toTokenAccount,
        new PublicKey(fromAddress),
        amountInSmallestUnit, // Amount in token's smallest unit
        [],
        TOKEN_PROGRAM_ID
      )
    );
    
    // Create transaction
    const transaction = new Transaction().add(...instructions);
    
    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = new PublicKey(fromAddress);
    
    return transaction;
  }, []);

  const processTokenPayment = async (
    amount: number,
    orderId: string,
    receiverWallet: string,
    tokenAddress: string
  ): Promise<PaymentResult> => {
    if (!validateWalletConnection()) {
      return { success: false, error: 'Wallet not connected' };
    }

    try {
      await ensureAuthenticated();
      setStatus({ processing: true, success: false, error: null, signature: null });

      // Create token payment transaction
      const transaction = await createTokenPayment(amount, walletAddress!, receiverWallet, tokenAddress);
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