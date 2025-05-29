import { 
  PublicKey, 
  Transaction, 
  SystemProgram, 
  LAMPORTS_PER_SOL,
  Commitment
} from '@solana/web3.js';
import { SOLANA_CONNECTION } from '../config/solana';
import { supabase } from '../lib/supabase';
import { prepareTransaction, validateTransaction } from '../utils/transaction';

const MAINNET_COMMITMENT: Commitment = 'finalized';
const MAINNET_FEE_BUFFER = 15000; // Increased fee buffer for mainnet

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

    if (!data?.wallet?.address) throw new Error('No wallet found for collection');
    return data.wallet.address;
  } catch (error) {
    console.error('Error getting collection wallet:', error);
    throw error;
  }
}

export async function createSolanaPayment(
  amount: number,
  buyerAddress: string,
  collectionId: string
): Promise<Transaction> {
  try {
    // Get the appropriate merchant wallet for this collection
    const merchantWalletAddress = await getCollectionWallet(collectionId);
    
    if (!merchantWalletAddress || !buyerAddress) {
      throw new Error('Invalid wallet addresses');
    }

    const merchantPubkey = new PublicKey(merchantWalletAddress);
    const buyerPubkey = new PublicKey(buyerAddress);
    
    // Convert SOL to lamports with proper rounding
    const lamports = Math.floor(amount * LAMPORTS_PER_SOL);
    if (lamports <= 0) {
      throw new Error('Invalid payment amount');
    }

    // Get balance in lamports for accurate comparison
    const balanceInLamports = await SOLANA_CONNECTION.getBalance(
      buyerPubkey,
      MAINNET_COMMITMENT
    );
    
    // Add buffer for transaction fee
    const requiredAmount = lamports + MAINNET_FEE_BUFFER;
    
    if (balanceInLamports < requiredAmount) {
      const requiredSol = requiredAmount / LAMPORTS_PER_SOL;
      throw new Error(`Insufficient balance. Required: ${requiredSol.toFixed(9)} SOL (including fees)`);
    }

    // Create transfer instruction
    const transferInstruction = SystemProgram.transfer({
      fromPubkey: buyerPubkey,
      toPubkey: merchantPubkey,
      lamports,
    });

    // Prepare transaction with fresh blockhash
    const transaction = await prepareTransaction([transferInstruction], buyerPubkey);

    // Double-check transaction validity
    if (!validateTransaction(transaction)) {
      throw new Error('Invalid transaction structure');
    }

    console.log("✅ Payment transaction created successfully");
    return transaction;
  } catch (error) {
    console.error('Error creating Solana payment:', error);
    throw error instanceof Error ? error : new Error('Failed to create payment transaction');
  }
}