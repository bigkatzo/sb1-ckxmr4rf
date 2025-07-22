import { useState, useCallback } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { PublicKey, Transaction } from '@solana/web3.js';
import { createSolanaPayment } from '../services/payments';
import { monitorTransaction } from '../utils/transaction-monitor';
import { updateTransactionStatus } from '../services/orders';
import { prepareTransaction } from '../utils/transaction';
import { toast } from 'react-toastify';
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  getAccount,
} from "@solana/spl-token";
import { SOLANA_CONNECTION } from '../config/solana';

const USDC_MINT = new PublicKey("Es9vMFrzaCERBzGBo4iK6d6VB7SGifdPMfShJT5PiyxP");

interface PaymentStatus {
  processing: boolean;
  success: boolean;
  error: string | null;
  signature?: string;
}

export function usePayment() {
  const { walletAddress, isConnected, ensureAuthenticated } = useWallet();
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

  const processPayment = async (amount: number, orderId: string, receiverWallet: string): Promise<{ success: boolean; signature?: string }> => {
    if (!isConnected || !walletAddress || !window.solana) {
      toast.error('Please connect your wallet first');
      setStatus({
        processing: false,
        success: false,
        error: 'Please connect your wallet first'
      });
      return { success: false };
    }

    try {
      // Ensure the wallet is authenticated before sending transactions
      await ensureAuthenticated();
      
      setStatus({ processing: true, success: false, error: null });

      // Create transaction with collection ID
      const transaction = await createSolanaPayment(amount, walletAddress, receiverWallet);
      console.log('✅ Payment transaction created successfully');

      // Prepare transaction with latest blockhash
      const preparedTx = await prepareTransaction(
        transaction,
        new PublicKey(walletAddress)
      );

      // Sign and send transaction directly via window.solana
      const { signature } = await window.solana.signAndSendTransaction(preparedTx);
      
      // Monitor transaction status
      const success = await monitorTransaction(signature, async (status) => {
        setStatus(status);
        
        if (status.success) {
          await updateTransactionStatus(signature, 'confirmed');
        } else if (status.error) {
          await updateTransactionStatus(signature, 'failed');
          toast.error(status.error, { autoClose: 5000 });
        }
      });

      return { success, signature };
    } catch (error) {
      console.error('Payment error:', error);
      
      let errorMessage = 'Payment failed';
      let signature: string | undefined;

      if (error && typeof error === 'object') {
        if (error instanceof Error) {
          const errorMsg = error.message || '';
          
          if (errorMsg.includes('Insufficient balance')) {
            const match = errorMsg.match(/Required: ([\d.]+) SOL/);
            const requiredAmount = match?.[1];
            errorMessage = requiredAmount 
              ? `Insufficient balance. Required: ${requiredAmount} SOL (including fees)`
              : 'Insufficient balance in your wallet';
          } else if (errorMsg.includes('User rejected')) {
            errorMessage = 'Transaction was rejected';
          } else {
            errorMessage = errorMsg || 'Payment failed';
          }
          
          // Check for signature in error message
          if (errorMsg.includes('signature:')) {
            signature = errorMsg.split('signature:')[1].trim();
          }
        } else if ('message' in error && typeof error.message === 'string') {
          errorMessage = error.message;
        }
      }

      toast.error(errorMessage);
      setStatus({
        processing: false,
        success: false,
        error: errorMessage,
        signature
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

export async function createUsdcPayment(
  amount: number,
  buyerAddress: string,
  merchantWalletAddress: string
): Promise<Transaction> {
  try {
    if (!buyerAddress || !merchantWalletAddress) {
      throw new Error("Invalid wallet addresses");
    }

    const buyerPubkey = new PublicKey(buyerAddress);
    const merchantPubkey = new PublicKey(merchantWalletAddress);

    const buyerTokenAccount = await getAssociatedTokenAddress(
      USDC_MINT,
      buyerPubkey
    );

    const merchantTokenAccount = await getAssociatedTokenAddress(
      USDC_MINT,
      merchantPubkey
    );

    // Check buyer has enough balance
    const buyerTokenAccountInfo = await getAccount(SOLANA_CONNECTION, buyerTokenAccount);
    const decimals = 6; // USDC has 6 decimals on Solana
    const amountInSmallestUnit = BigInt(Math.floor(amount * 10 ** decimals));

    if (buyerTokenAccountInfo.amount < amountInSmallestUnit) {
      throw new Error("Insufficient USDC balance");
    }

    const transferIx = createTransferInstruction(
      buyerTokenAccount,
      merchantTokenAccount,
      buyerPubkey, // Owner of source
      amountInSmallestUnit
    );

    const transaction = await prepareTransaction([transferIx], buyerPubkey);

    if (!validateTransaction(transaction)) {
      throw new Error("Invalid transaction structure");
    }

    console.log("✅ USDC payment transaction created successfully");
    return transaction;
  } catch (error) {
    console.error("Error creating USDC payment:", error);
    throw error instanceof Error ? error : new Error("Failed to create USDC payment");
  }
}