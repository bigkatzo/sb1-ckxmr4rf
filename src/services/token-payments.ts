import { 
  PublicKey, 
  Transaction, 
  TransactionInstruction
} from '@solana/web3.js';
import { SOLANA_CONNECTION } from '../config/solana';
import { createSolanaPayment } from './payments';
import { createTransferCheckedInstruction } from '@solana/spl-token';
import { supabase } from '../lib/supabase';

// USDC token on Solana
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

// Interface for token payment config
export interface TokenPaymentConfig {
  tokenMint: string;
  decimals: number;
}

// Known tokens configuration
export const SUPPORTED_TOKENS: Record<string, TokenPaymentConfig> = {
  'SOL': {
    tokenMint: 'native',
    decimals: 9
  },
  'USDC': {
    tokenMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    decimals: 6
  }
};

/**
 * Get price in USDC based on SOL price and conversion rate
 */
export function getSolToUsdcPrice(solAmount: number, solPriceInUsdc: number): number {
  return solAmount * solPriceInUsdc;
}

/**
 * Get price in SOL based on USDC price and conversion rate
 */
export function getUsdcToSolPrice(usdcAmount: number, solPriceInUsdc: number): number {
  // Guard against division by zero
  if (solPriceInUsdc <= 0) return 0;
  return usdcAmount / solPriceInUsdc;
}

// Helper function to get the collection wallet (copied from payments.ts)
export async function getCollectionWallet(collectionId: string): Promise<string> {
  try {
    // Get the wallet address directly from merchant_wallets through collection_wallets
    const { data, error } = await supabase
      .from('collection_wallets')
      .select(`
        wallet:wallet_id (
          address
        )
      `)
      .eq('collection_id', collectionId)
      .single();

    if (error) {
      // If no specific wallet is assigned, get the main wallet
      const { data: mainWallet, error: mainWalletError } = await supabase
        .from('merchant_wallets')
        .select('address')
        .eq('is_main', true)
        .eq('is_active', true)
        .single();

      if (mainWalletError) throw mainWalletError;
      if (!mainWallet) throw new Error('No active main wallet found');

      return mainWallet.address;
    }

    // Type assertion to help TypeScript understand the structure
    const walletData = data as unknown as { wallet: { address: string } };
    
    // Access the address safely
    if (!walletData?.wallet || !walletData.wallet.address) {
      throw new Error('No wallet found for collection');
    }
    
    return walletData.wallet.address;
  } catch (error) {
    console.error('Error getting collection wallet:', error);
    throw error;
  }
}

/**
 * Create a payment transaction for any supported token
 */
export async function createTokenPayment(
  tokenSymbol: string,
  amount: number,
  buyerAddress: string,
  collectionId: string
): Promise<Transaction> {
  try {
    // Handle native SOL payments with existing function
    if (tokenSymbol === 'SOL') {
      return createSolanaPayment(amount, buyerAddress, collectionId);
    }
    
    // For other tokens, use the SPL token program
    const tokenConfig = SUPPORTED_TOKENS[tokenSymbol];
    if (!tokenConfig) {
      throw new Error(`Unsupported token: ${tokenSymbol}`);
    }
    
    // Get the merchant wallet for this collection
    const merchantWalletAddress = await getCollectionWallet(collectionId);
    
    if (!merchantWalletAddress || !buyerAddress) {
      throw new Error('Invalid wallet addresses');
    }
    
    // Create token transfer instruction based on token type
    const transferInstruction = await createTokenTransferInstruction(
      tokenSymbol,
      amount,
      buyerAddress,
      merchantWalletAddress,
      tokenConfig
    );
    
    // Prepare transaction with fresh blockhash
    const buyerPubkey = new PublicKey(buyerAddress);
    const { prepareTransaction, validateTransaction } = await import('../utils/transaction');
    const transaction = await prepareTransaction([transferInstruction], buyerPubkey);
    
    // Double-check transaction validity
    if (!validateTransaction(transaction)) {
      throw new Error('Invalid transaction structure');
    }
    
    console.log(`✅ ${tokenSymbol} payment transaction created successfully`);
    return transaction;
  } catch (error) {
    console.error(`Error creating ${tokenSymbol} payment:`, error);
    throw error instanceof Error ? error : new Error(`Failed to create ${tokenSymbol} payment transaction`);
  }
}

/**
 * Create a token transfer instruction for the specified token
 */
async function createTokenTransferInstruction(
  tokenSymbol: string,
  amount: number,
  senderAddress: string,
  recipientAddress: string,
  tokenConfig: TokenPaymentConfig
): Promise<TransactionInstruction> {
  const senderPubkey = new PublicKey(senderAddress);
  const recipientPubkey = new PublicKey(recipientAddress);
  
  // For SPL tokens like USDC
  if (tokenConfig.tokenMint !== 'native') {
    // Get sender's token account
    const mintPubkey = new PublicKey(tokenConfig.tokenMint);
    const tokenAccounts = await SOLANA_CONNECTION.getTokenAccountsByOwner(
      senderPubkey,
      { mint: mintPubkey }
    );
    
    if (tokenAccounts.value.length === 0) {
      throw new Error(`No ${tokenSymbol} token account found for this wallet`);
    }
    
    // Get the first token account (there's typically only one per mint)
    const sourceTokenAccount = tokenAccounts.value[0].pubkey;
    
    // Get or create recipient's token account
    const recipientTokenAccounts = await SOLANA_CONNECTION.getTokenAccountsByOwner(
      recipientPubkey,
      { mint: mintPubkey }
    );
    
    // If recipient doesn't have a token account, we would need to create one
    // This is simplified - in production you'd want to handle the case where
    // the recipient needs an account created
    if (recipientTokenAccounts.value.length === 0) {
      throw new Error(`Recipient doesn't have a ${tokenSymbol} token account`);
    }
    
    const destinationTokenAccount = recipientTokenAccounts.value[0].pubkey;
    
    // Convert amount to token units with proper decimals
    const tokenAmount = Math.floor(amount * (10 ** tokenConfig.decimals));
    
    if (tokenAmount <= 0) {
      throw new Error('Invalid payment amount');
    }
    
    // Check if sender has sufficient balance
    const balance = await SOLANA_CONNECTION.getTokenAccountBalance(sourceTokenAccount);
    const tokenBalance = Number(balance.value.amount);
    
    if (tokenBalance < tokenAmount) {
      throw new Error(`Insufficient ${tokenSymbol} balance`);
    }
    
    // Create SPL token transfer instruction
    return createTransferCheckedInstruction(
      sourceTokenAccount,                 // source
      mintPubkey,                         // mint (token)
      destinationTokenAccount,            // destination
      senderPubkey,                       // owner
      tokenAmount,                        // amount
      tokenConfig.decimals,               // decimals
      [],                                 // multiSigners
      TOKEN_PROGRAM_ID                    // programId
    );
  }
  
  // This should never happen as native SOL is handled separately
  throw new Error('Invalid token configuration');
} 