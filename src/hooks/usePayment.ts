import { useState, useCallback } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { createSolanaPayment } from '../services/payments';
import { monitorTransaction } from '../utils/transaction-monitor';
import { updateTransactionStatus } from '../services/orders';
import { prepareTransaction } from '../utils/transaction';
import { toast } from 'react-toastify';
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  getAccount,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { SOLANA_CONNECTION } from '../config/solana';

const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"); // Mainnet USDC
const USDC_DECIMALS = 6;
const JUPITER_API_URL = 'https://quote-api.jup.ag/v6';

interface PaymentStatus {
  processing: boolean;
  success: boolean;
  error: string | null;
  signature?: string;
}

interface PaymentResult {
  success: boolean;
  signature?: string;
  error?: string;
}

interface SwapQuote {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string; // Added missing property
  routePlan: any[];
  platformFee?: {
    amount: string;
    feeBps: number;
  };
}

interface SwapRequest {
  quoteResponse: SwapQuote;
  userPublicKey: string;
  wrapAndUnwrapSol: boolean;
  dynamicComputeUnitLimit: boolean;
  priorityLevelWithMaxLamports: {
    priorityLevel: string;
    maxLamports?: number; // Added missing property
  };
  destinationTokenAccount?: string; // Added missing property
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

  // Helper function to validate wallet connection
  const validateWalletConnection = (): boolean => {
    if (!isConnected || !walletAddress) {
      const errorMsg = 'Please connect your wallet first';
      toast.error(errorMsg);
      setStatus({
        processing: false,
        success: false,
        error: errorMsg
      });
      return false;
    }

    if (!window.solana) {
      const errorMsg = 'Solana wallet not found. Please install a Solana wallet extension.';
      toast.error(errorMsg);
      setStatus({
        processing: false,
        success: false,
        error: errorMsg
      });
      return false;
    }

    return true;
  };

  // Helper function to handle errors consistently
  const handlePaymentError = (error: unknown): PaymentResult => {
    console.error('Payment error:', error);
    
    let errorMessage = 'Payment failed';
    let signature: string | undefined;

    if (error instanceof Error) {
      const errorMsg = error.message;
      
      if (errorMsg.includes('Insufficient balance') || errorMsg.includes('insufficient funds')) {
        const match = errorMsg.match(/Required: ([\d.]+) SOL/);
        const requiredAmount = match?.[1];
        errorMessage = requiredAmount 
          ? `Insufficient balance. Required: ${requiredAmount} SOL (including fees)`
          : 'Insufficient balance in your wallet';
      } else if (errorMsg.includes('User rejected') || errorMsg.includes('rejected')) {
        errorMessage = 'Transaction was rejected by user';
      } else if (errorMsg.includes('signature:')) {
        signature = errorMsg.split('signature:')[1]?.trim();
        errorMessage = errorMsg;
      } else {
        errorMessage = errorMsg || 'Payment failed';
      }
    } else if (error && typeof error === 'object' && 'message' in error) {
      errorMessage = String(error.message);
    }

    toast.error(errorMessage, { autoClose: 5000 });
    setStatus({
      processing: false,
      success: false,
      error: errorMessage,
      signature
    });
    
    return { success: false, error: errorMessage, signature };
  };

  // Helper function to get Jupiter swap quote
  const getJupiterQuote = async (
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number = 300 // 3% default slippage
  ): Promise<SwapQuote> => {
    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount: amount.toString(),
      slippageBps: slippageBps.toString(),
      swapMode: 'ExactOut',
      onlyDirectRoutes: 'false',
      asLegacyTransaction: 'false'
    });

    console.log('🔄 Fetching Jupiter quote with params:', params.toString());

    const response = await fetch(`${JUPITER_API_URL}/quote?${params}`);
    
    if (!response.ok) {
      throw new Error(`Jupiter API error: ${response.statusText}`);
    }

    const quote = await response.json();
    
    if (!quote || quote.error) {
      throw new Error(quote?.error || 'Failed to get swap quote');
    }

    return quote;
  };

  // Helper function to get Jupiter swap transaction
  const getJupiterSwapTransaction = async (
    quote: SwapQuote,
    userPublicKey: string,
    destinationTokenAccount?: string,
    priorityFee?: number
  ): Promise<string> => {
    const swapRequest: SwapRequest = {
      quoteResponse: quote,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      priorityLevelWithMaxLamports: {
        priorityLevel: "medium"
      }
    };

    // Add destination token account if specified
    if (destinationTokenAccount) {
      swapRequest.destinationTokenAccount = destinationTokenAccount;
    }

    if (priorityFee) {
      swapRequest.priorityLevelWithMaxLamports = {
        priorityLevel: "custom",
        maxLamports: priorityFee
      };
    }

    const response = await fetch(`${JUPITER_API_URL}/swap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(swapRequest)
    });

    if (!response.ok) {
      throw new Error(`Jupiter swap API error: ${response.statusText}`);
    }

    const { swapTransaction } = await response.json();
    
    if (!swapTransaction) {
      throw new Error('Failed to get swap transaction');
    }

    return swapTransaction;
  };

  const ensureTokenAccount = async (
    tokenMint: PublicKey,
    owner: PublicKey,
    instructions: TransactionInstruction[]
  ): Promise<PublicKey> => {
    const tokenAccount = await getAssociatedTokenAddress(tokenMint, owner);
    
    try {
      // Try to get account info from the connection
      const accountInfo = await SOLANA_CONNECTION.getAccountInfo(tokenAccount);
      
      if (!accountInfo) {
        // Account doesn't exist, create it
        console.log("Token account does not exist, creating...");
        const createAccountIx = createAssociatedTokenAccountInstruction(
          owner,
          tokenAccount,
          owner,
          tokenMint
        );
        instructions.push(createAccountIx);
      } else {
        console.log("Token account exists");
      }
    } catch (error) {
      // If there's any error checking the account, assume it doesn't exist and create it
      console.log("Error checking token account, creating...", error);
      const createAccountIx = createAssociatedTokenAccountInstruction(
        owner,
        tokenAccount,
        owner,
        tokenMint
      );
      instructions.push(createAccountIx);
    }
    
    return tokenAccount;
  };
  

  const processSolanaSwapTokenPayment = async (
    inputTokenMint: string,
    outputTokenMint: string = USDC_MINT.toString(),
    inputAmount: number,
    receiverWallet?: string,
    slippageBps: number = 300,
    priorityFee?: number
  ): Promise<PaymentResult & { quote?: SwapQuote; outputAmount?: string }> => {
    if (!validateWalletConnection()) {
      return { success: false, error: 'Wallet not connected' };
    }

    try {
      await ensureAuthenticated();
      setStatus({ processing: true, success: false, error: null });

      inputAmount = Math.floor(inputAmount * 10 ** USDC_DECIMALS); // Convert to smallest unit (e.g., 6 decimals for USDC)

      console.log('🔄 Getting Jupiter swap quote...', inputAmount);
      
      // Get swap quote from Jupiter
      const quote = await getJupiterQuote(
        inputTokenMint,
        outputTokenMint,
        inputAmount,
        slippageBps
      );

      console.log('✅ Jupiter quote received:', {
        inputAmount: quote.inAmount,
        outputAmount: quote.outAmount,
        priceImpact: quote.priceImpactPct
      });

      // Check if price impact is too high (optional safeguard)
      const priceImpact = parseFloat(quote.priceImpactPct);
      if (priceImpact > 10) { // 10% price impact threshold
        const warningMsg = `High price impact: ${priceImpact.toFixed(2)}%. Continue?`;
        if (!window.confirm(warningMsg)) {
          throw new Error('Transaction cancelled due to high price impact');
        }
      }

      // Get swap transaction from Jupiter
      console.log('🔄 Getting swap transaction...');
      
      let destinationTokenAccount: string | undefined;
      
      // If receiver wallet is specified, get their associated token account
      if (receiverWallet) {
        try {
          const receiverPubkey = new PublicKey(receiverWallet);
          const outputMintPubkey = new PublicKey(outputTokenMint);
          
          destinationTokenAccount = (await getAssociatedTokenAddress(
            outputMintPubkey,
            receiverPubkey
          )).toString();
          
          console.log('✅ Destination token account:', destinationTokenAccount);
        } catch (error) {
          console.error('Error getting destination token account:', error);
          throw new Error('Invalid receiver wallet address');
        }
      }
      
      const swapTransactionBase64 = await getJupiterSwapTransaction(
        quote,
        walletAddress!,
        destinationTokenAccount,
        priorityFee
      );

      // Deserialize transaction
      const swapTransactionBuf = Buffer.from(swapTransactionBase64, 'base64');
      const transaction = Transaction.from(swapTransactionBuf);

      // Type guard to ensure window.solana exists
      if (!window.solana) {
        throw new Error('Solana wallet not available');
      }

      console.log('🔄 Signing and sending swap transaction...', swapTransactionBuf);
      
      // Sign and send transaction
      const { signature } = await window.solana.signAndSendTransaction(transaction);
      
      console.log("✅ Swap transaction sent successfully:", signature);
      
      // Monitor transaction status
      const success = await monitorTransaction(signature, async (status) => {
        setStatus(status);
        
        if (status.success) {
          await updateTransactionStatus(signature, 'confirmed');
          const outputAmountFormatted = (parseInt(quote.outAmount) / 10**6).toFixed(6);
          const successMessage = receiverWallet 
            ? `Swap completed! Sent ${outputAmountFormatted} tokens to receiver`
            : `Swap completed! Received ${outputAmountFormatted} tokens`;
          toast.success(successMessage);
        } else if (status.error) {
          await updateTransactionStatus(signature, 'failed');
        }
      });

      return { 
        success, 
        signature, 
        quote,
        outputAmount: quote.outAmount
      };

    } catch (error) {
      const result = handlePaymentError(error);
      return {
        ...result,
        quote: undefined,
        outputAmount: undefined
      };
    }
  };

  const processTokenPayment = async (
    amount: number,
    orderId: string,
    merchantWalletAddress: string,
    tokenMint: PublicKey = USDC_MINT
  ): Promise<PaymentResult> => {
    if (!validateWalletConnection()) {
      return { success: false, error: 'Wallet not connected' };
    }

    try {
      await ensureAuthenticated();
      setStatus({ processing: true, success: false, error: null });

      const buyerPubkey = new PublicKey(walletAddress!);
      const merchantPubkey = new PublicKey(merchantWalletAddress);
      const instructions: TransactionInstruction[] = [];

      // Ensure both token accounts exist
      const buyerTokenAccount = await ensureTokenAccount(tokenMint, buyerPubkey, instructions);
      const merchantTokenAccount = await ensureTokenAccount(tokenMint, merchantPubkey, instructions);

      let amountInSmallestUnit: bigint;

      try {
        const buyerTokenAccountInfo = await getAccount(SOLANA_CONNECTION, buyerTokenAccount);
        amountInSmallestUnit = BigInt(Math.floor(amount * 10 ** USDC_DECIMALS));

        if (buyerTokenAccountInfo.amount < amountInSmallestUnit) {
          throw new Error(`Insufficient ${tokenMint.equals(USDC_MINT) ? 'USDC' : 'token'} balance`);
        }
      } catch (error) {
        throw new Error(`Insufficient ${tokenMint.equals(USDC_MINT) ? 'USDC' : 'token'} balance`);
      }

      // Create transfer instruction
      const transferIx = createTransferInstruction(
        buyerTokenAccount,
        merchantTokenAccount,
        buyerPubkey,
        amountInSmallestUnit
      );

      instructions.push(transferIx);

      console.log('🔄 Preparing transaction with instructions:', instructions);

      // Prepare and send transaction
      const transaction = await prepareTransaction(instructions, buyerPubkey);

      console.log('✅ Transaction prepared successfully', transaction);
      
      // Type guard to ensure window.solana exists
      if (!window.solana) {
        throw new Error('Solana wallet not available');
      }
      
      const { signature } = await window.solana.signAndSendTransaction(transaction);

      console.log("✅ Token payment transaction sent successfully:", signature);
      
      // Monitor transaction status
      const success = await monitorTransaction(signature, async (status) => {
        setStatus(status);
        
        if (status.success) {
          await updateTransactionStatus(signature, 'confirmed');
          toast.success('Payment confirmed!');
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
      setStatus({ processing: true, success: false, error: null });

      // Create SOL payment transaction
      const transaction = await createSolanaPayment(amount, walletAddress!, receiverWallet);
      console.log('✅ SOL payment transaction created successfully');

      // Prepare transaction with latest blockhash
      const preparedTx = await prepareTransaction(
        transaction instanceof Transaction ? transaction.instructions : transaction,
        new PublicKey(walletAddress!)
      );

      // Type guard to ensure window.solana exists
      if (!window.solana) {
        throw new Error('Solana wallet not available');
      }

      // Sign and send transaction
      const { signature } = await window.solana.signAndSendTransaction(preparedTx);
      console.log("✅ SOL payment transaction sent successfully:", signature);
      
      // Monitor transaction status
      const success = await monitorTransaction(signature, async (status) => {
        setStatus(status);
        
        if (status.success) {
          await updateTransactionStatus(signature, 'confirmed');
          toast.success('Payment confirmed!');
        } else if (status.error) {
          await updateTransactionStatus(signature, 'failed');
        }
      });

      return { success, signature };

    } catch (error) {
      return handlePaymentError(error);
    }
  };

  return {
    processPayment,
    processTokenPayment,
    processSolanaSwapTokenPayment,
    status,
    resetStatus
  };
}