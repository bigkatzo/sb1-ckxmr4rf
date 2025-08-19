import { useState, useCallback } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { Transaction, PublicKey, Connection, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, createTransferInstruction, getAccount, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { SOLANA_CONNECTION } from '../config/solana';
import { tokenService } from '../services/tokenService';
import { toast } from 'react-toastify';

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

interface JupiterQuoteResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee?: {
    feeBps: number;
    feeAccounts: Record<string, string>;
  };
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
  contextSlot: number;
  timeTaken: number;
}

interface JupiterSwapRequest {
  quoteResponse: JupiterQuoteResponse;
  userPublicKey: string;
  wrapUnwrapSOL?: boolean;
}

interface JupiterSwapResponse {
  swapTransaction: string;
}

export function usePayment() {
  const { 
    walletAddress, 
    isConnected, 
    signAndSendTransaction, 
    ensureAuthenticated,
    isEmbeddedWallet 
  } = useWallet();
  
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
      
      // Wait for finalization with timeout
      const confirmation = await connection.confirmTransaction(signature, 'finalized');
      
      const success = !confirmation.value.err;
      
      const newStatus: PaymentStatus = {
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
      const newStatus: PaymentStatus = {
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

  const updateTransactionStatus = useCallback(async (signature: string, status: string) => {
    try {
      // Update transaction status in your backend/database
      console.log(`Transaction ${signature} status updated to: ${status}`);
    } catch (error) {
      console.error('Error updating transaction status:', error);
    }
  }, []);

  // Check user's token balance before processing payment
  const checkTokenBalance = useCallback(async (
    tokenAddress: string,
    requiredAmount: number
  ): Promise<{ hasEnough: boolean; balance: number; error?: string }> => {
    try {
      const connection = new Connection(SOLANA_CONNECTION.rpcEndpoint);
      
      // Get token info to determine decimals
      const tokenInfo = await tokenService.getTokenInfo(tokenAddress);
      const decimals = tokenInfo.decimals || 6;
      
      // Convert required amount to smallest unit
      const requiredAmountInSmallestUnit = Math.floor(requiredAmount * Math.pow(10, decimals));
      
      // Get user's token account
      const userTokenAccount = getAssociatedTokenAddressSync(
        new PublicKey(tokenAddress),
        new PublicKey(walletAddress!)
      );
      
      try {
        const accountInfo = await getAccount(connection, userTokenAccount);
        const balance = Number(accountInfo.amount);
        
        const hasEnough = balance >= requiredAmountInSmallestUnit;
        
        return {
          hasEnough,
          balance: balance / Math.pow(10, decimals),
          error: hasEnough ? undefined : `Insufficient balance. You have ${balance / Math.pow(10, decimals)} but need ${requiredAmount}`
        };
      } catch (error) {
        // Token account doesn't exist, so balance is 0
        return {
          hasEnough: false,
          balance: 0,
          error: `No ${tokenInfo.symbol} tokens found. You need ${requiredAmount} ${tokenInfo.symbol} to proceed.`
        };
      }
    } catch (error) {
      console.error('Error checking token balance:', error);
      return {
        hasEnough: false,
        balance: 0,
        error: 'Failed to check token balance'
      };
    }
  }, [walletAddress]);

  // Jupiter API functions for token swaps
  const getJupiterQuote = useCallback(async (
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number = 500, // 5% default slippage
    swapMode: 'ExactIn' | 'ExactOut' = 'ExactIn'
  ): Promise<JupiterQuoteResponse | null> => {
    try {
      // Get token decimals for accurate conversion
      const inputTokenInfo = await tokenService.getTokenInfo(inputMint);
      const outputTokenInfo = await tokenService.getTokenInfo(outputMint);
      const inputDecimals = inputTokenInfo.decimals || 6;
      const outputDecimals = outputTokenInfo.decimals || 6;
      
      // Convert amount to smallest unit based on swap mode
      const amountInSmallestUnit = Math.floor(amount * Math.pow(10, swapMode === 'ExactOut' ? outputDecimals : inputDecimals));
      
      const url = `https://quote-api.jup.ag/v6/quote?` +
        `inputMint=${inputMint}&` +
        `outputMint=${outputMint}&` +
        `amount=${amountInSmallestUnit}&` +
        `slippageBps=${slippageBps}&` +
        `onlyDirectRoutes=false&` +
        `asLegacyTransaction=false&` +
        `swapMode=${swapMode}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Jupiter API error: ${response.status}`);
      }

      const data = await response.json();
      return {
        ...data,
        inputDecimals,
        outputDecimals
      };
    } catch (error) {
      console.error('Jupiter quote error:', error);
      return null;
    }
  }, []);

  const getJupiterSwapTransaction = useCallback(async (
    quoteResponse: JupiterQuoteResponse,
    userPublicKey: string
  ): Promise<string | null> => {
    try {
      const swapRequest: JupiterSwapRequest = {
        quoteResponse,
        userPublicKey,
        wrapUnwrapSOL: true
      };

      const response = await fetch('https://quote-api.jup.ag/v6/swap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(swapRequest),
      });

      if (!response.ok) {
        throw new Error(`Jupiter swap API error: ${response.status}`);
      }

      const data: JupiterSwapResponse = await response.json();
      return data.swapTransaction;
    } catch (error) {
      console.error('Jupiter swap transaction error:', error);
      return null;
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

  // Jupiter swap payment function - swaps SPL tokens to USDC
  const processSwapPayment = useCallback(async (
    amount: number,
    orderId: string,
    receiverWallet: string,
    inputTokenAddress: string,
    outputTokenAddress: string = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' // USDC
  ): Promise<PaymentResult> => {
    if (!validateWalletConnection()) {
      return { success: false, error: 'Wallet not connected' };
    }

    try {
      await ensureAuthenticated();
      setStatus({ processing: true, success: false, error: null, signature: null });

      console.log('🔄 Starting Jupiter swap payment...');
      console.log(`Input token: ${inputTokenAddress}`);
      console.log(`Output token: ${outputTokenAddress}`);
      console.log(`Amount: ${amount} (exact output amount in USDC)`);
      console.log(`Receiver wallet: ${receiverWallet}`);
      console.log(`Wallet type: ${isEmbeddedWallet ? 'Embedded' : 'External'}`);

      // Get token info to determine decimals
      const inputTokenInfo = await tokenService.getTokenInfo(inputTokenAddress);
      const outputTokenInfo = await tokenService.getTokenInfo(outputTokenAddress);
      const inputDecimals = inputTokenInfo.decimals || 6;
      const outputDecimals = outputTokenInfo.decimals || 6;
      
      // Convert amount to output token's smallest unit (USDC)
      const amountInOutputSmallestUnit = Math.floor(amount * Math.pow(10, outputDecimals));
      
      console.log(`Amount in USDC smallest unit: ${amountInOutputSmallestUnit}`);

      // Try ExactOut first (we want exact USDC output)
      let quote = await getJupiterQuote(inputTokenAddress, outputTokenAddress, amount, 500, 'ExactOut');
      
      // If ExactOut fails, try ExactIn with a reasonable input amount estimate
      if (!quote) {
        console.log('⚠️ ExactOut quote failed, trying ExactIn mode...');
        
        // For ExactIn, we need to convert USDC amount to input token amount
        // First get a quote from USDC to input token to estimate the conversion rate
        const reverseQuote = await getJupiterQuote(outputTokenAddress, inputTokenAddress, amount, 500, 'ExactIn');
        
        if (!reverseQuote) {
          throw new Error('Failed to get reverse quote for ExactIn fallback');
        }
        
        // Calculate the input token amount needed based on the reverse quote
        const inputAmountNeeded = parseInt(reverseQuote.outAmount) / Math.pow(10, inputDecimals);
        const estimatedInputAmount = inputAmountNeeded * 1.1; // Add 10% buffer for slippage
        
        console.log(`Estimated input amount needed: ${estimatedInputAmount} ${inputTokenInfo.symbol}`);
        
        quote = await getJupiterQuote(inputTokenAddress, outputTokenAddress, estimatedInputAmount, 500, 'ExactIn');
        
        if (!quote) {
          throw new Error('Failed to get Jupiter quote for token swap in both ExactOut and ExactIn modes');
        }
        
        console.log('✅ ExactIn quote received as fallback');
      } else {
        console.log('✅ ExactOut quote received');
      }

      console.log('✅ Jupiter quote received:', quote);
      const inputAmountNeeded = parseInt(quote.inAmount) / Math.pow(10, inputDecimals);
      const outputAmount = parseInt(quote.outAmount) / Math.pow(10, outputDecimals);
      console.log(`Input amount needed: ${inputAmountNeeded} ${inputTokenInfo.symbol}`);
      console.log(`Output amount: ${outputAmount} USDC`);

      // Check user's input token balance using the actual input amount from quote
      const balanceCheck = await checkTokenBalance(inputTokenAddress, inputAmountNeeded);
      if (!balanceCheck.hasEnough) {
        toast.error(balanceCheck.error || 'Insufficient token balance');
        throw new Error(balanceCheck.error || 'Insufficient token balance');
      }

      console.log(`✅ Token balance verified: ${balanceCheck.balance} tokens available`);

      // Get swap transaction
      const swapTransactionBase64 = await getJupiterSwapTransaction(quote, walletAddress!);
      if (!swapTransactionBase64) {
        throw new Error('Failed to create Jupiter swap transaction');
      }

      console.log('✅ Jupiter swap transaction created');

      // Deserialize and sign the transaction
      const connection = new Connection(SOLANA_CONNECTION.rpcEndpoint);
      const swapTransaction = Transaction.from(Buffer.from(swapTransactionBase64, 'base64'));
      
      // Sign and send transaction using Privy (works for both embedded and external wallets)
      const signature = await signAndSendTransaction(swapTransaction);
      console.log("✅ Jupiter swap transaction sent successfully:", signature);
      
      // Monitor transaction status
      const success = await monitorTransaction(signature, async (status) => {
        setStatus(status);
        
        if (status.success) {
          await updateTransactionStatus(signature, 'confirmed');
          console.log('✅ Jupiter swap completed successfully');
          console.log(`User paid with ${inputAmountNeeded} ${inputTokenInfo.symbol}, receiver gets ${outputAmount} USDC`);
        } else if (status.error) {
          await updateTransactionStatus(signature, 'failed');
          console.error('❌ Jupiter swap failed:', status.error);
        }
      });

      return { success, signature };

    } catch (error) {
      console.error('❌ Jupiter swap payment error:', error);
      return handlePaymentError(error);
    }
  }, [validateWalletConnection, ensureAuthenticated, checkTokenBalance, getJupiterQuote, getJupiterSwapTransaction, signAndSendTransaction, monitorTransaction, updateTransactionStatus, handlePaymentError, walletAddress, isEmbeddedWallet]);

  const processTokenPayment = useCallback(async (
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

      console.log('🔄 Starting token payment...');
      console.log(`Token: ${tokenAddress}`);
      console.log(`Amount: ${amount}`);
      console.log(`Wallet type: ${isEmbeddedWallet ? 'Embedded' : 'External'}`);

      // Check user's token balance first
      const balanceCheck = await checkTokenBalance(tokenAddress, amount);
      if (!balanceCheck.hasEnough) {
        toast.error(balanceCheck.error || 'Insufficient token balance');
        throw new Error(balanceCheck.error || 'Insufficient token balance');
      }

      console.log(`✅ Token balance verified: ${balanceCheck.balance} tokens available`);

      // Create token payment transaction
      const transaction = await createTokenPayment(amount, walletAddress!, receiverWallet, tokenAddress);
      console.log('✅ Token payment transaction created successfully');

      // Sign and send transaction using Privy (works for both embedded and external wallets)
      const signature = await signAndSendTransaction(transaction);
      console.log("✅ Token payment transaction sent successfully:", signature);
      
      // Monitor transaction status
      const success = await monitorTransaction(signature, async (status) => {
        setStatus(status);
        
        if (status.success) {
          await updateTransactionStatus(signature, 'confirmed');
          console.log('✅ Token payment completed successfully');
        } else if (status.error) {
          await updateTransactionStatus(signature, 'failed');
          console.error('❌ Token payment failed:', status.error);
        }
      });

      return { success, signature };

    } catch (error) {
      console.error('❌ Token payment error:', error);
      return handlePaymentError(error);
    }
  }, [validateWalletConnection, ensureAuthenticated, checkTokenBalance, createTokenPayment, signAndSendTransaction, monitorTransaction, updateTransactionStatus, handlePaymentError, walletAddress, isEmbeddedWallet]);

  const processPayment = useCallback(async (
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

      console.log('🔄 Starting SOL payment...');
      console.log(`Amount: ${amount} SOL`);
      console.log(`Wallet type: ${isEmbeddedWallet ? 'Embedded' : 'External'}`);

      // Check SOL balance
      const connection = new Connection(SOLANA_CONNECTION.rpcEndpoint);
      const balance = await connection.getBalance(new PublicKey(walletAddress!));
      const solBalance = balance / LAMPORTS_PER_SOL;
      
      if (solBalance < amount) {
        toast.error(`Insufficient SOL balance. You have ${solBalance.toFixed(4)} SOL but need ${amount} SOL`);
        throw new Error(`Insufficient SOL balance. You have ${solBalance.toFixed(4)} SOL but need ${amount} SOL`);
      }

      console.log(`✅ SOL balance verified: ${solBalance.toFixed(4)} SOL available`);

      // Create SOL payment transaction
      const transaction = await createSolanaPayment(amount, walletAddress!, receiverWallet);
      console.log('✅ SOL payment transaction created successfully');

      // Sign and send transaction using Privy (works for both embedded and external wallets)
      const signature = await signAndSendTransaction(transaction);
      console.log("✅ SOL payment transaction sent successfully:", signature);
      
      // Monitor transaction status
      const success = await monitorTransaction(signature, async (status) => {
        setStatus(status);
        
        if (status.success) {
          await updateTransactionStatus(signature, 'confirmed');
          console.log('✅ SOL payment completed successfully');
        } else if (status.error) {
          await updateTransactionStatus(signature, 'failed');
          console.error('❌ SOL payment failed:', status.error);
        }
      });

      return { success, signature };

    } catch (error) {
      console.error('❌ SOL payment error:', error);
      return handlePaymentError(error);
    }
  }, [validateWalletConnection, ensureAuthenticated, createSolanaPayment, signAndSendTransaction, monitorTransaction, updateTransactionStatus, handlePaymentError, walletAddress, isEmbeddedWallet]);

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
    processSwapPayment,
    checkTokenBalance,
    status,
    resetStatus,
    isConnected,
    walletAddress,
    isEmbeddedWallet
  };
}