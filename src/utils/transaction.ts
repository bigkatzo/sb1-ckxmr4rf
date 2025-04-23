import { Transaction, TransactionInstruction, PublicKey } from '@solana/web3.js';
import { SOLANA_CONNECTION } from '../config/solana';

const MAX_RETRIES = 5;
const BASE_DELAY = 2000;
const CONFIRMATION_TIMEOUT = 60000; // 60 seconds

export function validateTransaction(transaction: Transaction): boolean {
  if (!transaction.recentBlockhash) {
    console.error('Missing recentBlockhash');
    return false;
  }

  if (!transaction.feePayer) {
    console.error('Missing feePayer');
    return false;
  }

  if (!transaction.instructions.length) {
    console.error('No instructions in transaction');
    return false;
  }

  return true;
}

// Overload for preparing a Transaction
export async function prepareTransaction(
  transaction: Transaction,
  feePayer: PublicKey
): Promise<Transaction>;

// Overload for preparing a new transaction from instructions
export async function prepareTransaction(
  instructions: TransactionInstruction[],
  feePayer: PublicKey
): Promise<Transaction>;

// Implementation for both overloads
export async function prepareTransaction(
  transactionOrInstructions: Transaction | TransactionInstruction[],
  feePayer: PublicKey
): Promise<Transaction> {
  try {
    // Get fresh blockhash with retry
    const { blockhash, lastValidBlockHeight } = await getLatestBlockhashWithRetry();

    let transaction: Transaction;
    
    if (transactionOrInstructions instanceof Transaction) {
      // If we already have a transaction, just update its blockhash and fee payer
      transaction = transactionOrInstructions;
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;
      transaction.feePayer = feePayer;
    } else {
      // Create a new transaction from instructions
      transaction = new Transaction();
      transaction.feePayer = feePayer;
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;

      transactionOrInstructions.forEach(instruction => {
        transaction.add(instruction);
      });
    }

    if (!validateTransaction(transaction)) {
      throw new Error('Invalid transaction: missing required fields');
    }

    return transaction;
  } catch (error) {
    console.error('Error preparing transaction:', error);
    throw error instanceof Error ? error : new Error('Failed to prepare transaction');
  }
}

async function getLatestBlockhashWithRetry(
  maxRetries = 3,
  delayMs = 1000
): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`Getting latest blockhash (attempt ${attempt + 1}/${maxRetries})`);
      
      const { blockhash, lastValidBlockHeight } = await SOLANA_CONNECTION.getLatestBlockhash({
        commitment: 'finalized'
      });

      if (!blockhash || !lastValidBlockHeight) {
        throw new Error('Invalid blockhash response');
      }

      console.log('Got valid blockhash:', {
        blockhash: blockhash.slice(0, 8) + '...',
        lastValidBlockHeight,
        attempt: attempt + 1
      });

      return { blockhash, lastValidBlockHeight };
    } catch (error) {
      console.error(`Blockhash fetch attempt ${attempt + 1} failed:`, error);
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      if (attempt < maxRetries - 1) {
        const jitter = Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, attempt) + jitter));
      }
    }
  }

  throw lastError || new Error('Failed to get latest blockhash after retries');
}

export async function confirmTransactionWithRetry(
  signature: string,
  maxRetries = MAX_RETRIES
): Promise<boolean> {
  let attempts = 0;

  while (attempts < maxRetries) {
    try {
      console.log(`🔄 Confirming transaction attempt ${attempts + 1}/${maxRetries}`);
      console.log("🔍 Transaction signature:", signature);

      // Get fresh blockhash for each attempt
      const { blockhash, lastValidBlockHeight } = await getLatestBlockhashWithRetry();
      
      // Wait for confirmation with timeout
      const confirmation: any = await Promise.race([
        SOLANA_CONNECTION.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight
        }, 'finalized'),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Confirmation timeout')), CONFIRMATION_TIMEOUT)
        )
      ]);

      if (confirmation.value?.err) {
        throw new Error(`Transaction error: ${confirmation.value.err}`);
      }

      // Double-check transaction status
      const txInfo = await SOLANA_CONNECTION.getTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: 'finalized'
      });

      if (!txInfo || txInfo.meta?.err) {
        throw new Error('Transaction verification failed');
      }

      console.log("✅ Transaction confirmed successfully");
      return true;
    } catch (error) {
      console.error(`❌ Confirmation attempt ${attempts + 1} failed:`, error);
      attempts++;
      
      if (attempts < maxRetries) {
        // Exponential backoff with jitter
        const jitter = Math.random() * 2000;
        const delay = BASE_DELAY * Math.pow(2, attempts - 1) + jitter;
        console.log(`Waiting ${Math.round(delay/1000)}s before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  return false;
}

export async function retryTransaction(
  transaction: Transaction,
  maxRetries = MAX_RETRIES
): Promise<string> {
  let attempts = 0;
  let lastError: Error | null = null;

  while (attempts < maxRetries) {
    try {
      // Get fresh blockhash for each attempt
      const { blockhash, lastValidBlockHeight } = await getLatestBlockhashWithRetry();
      
      // Update transaction with fresh blockhash
      transaction.recentBlockhash = blockhash;
      transaction.lastValidBlockHeight = lastValidBlockHeight;

      // Send transaction with preflight checks
      const signature = await SOLANA_CONNECTION.sendRawTransaction(
        transaction.serialize(),
        { 
          skipPreflight: false,
          preflightCommitment: 'finalized',
          maxRetries: 3
        }
      );

      // Confirm transaction with retry logic
      const success = await confirmTransactionWithRetry(signature);
      if (!success) {
        throw new Error('Transaction failed to confirm');
      }

      console.log(`✅ Transaction succeeded on attempt ${attempts + 1}`);
      return signature;
    } catch (error) {
      console.error(`❌ Transaction attempt ${attempts + 1} failed:`, error);
      lastError = error instanceof Error ? error : new Error('Unknown error');
      attempts++;
      
      if (attempts < maxRetries) {
        // Exponential backoff with jitter
        const jitter = Math.random() * 2000;
        const delay = BASE_DELAY * Math.pow(2, attempts - 1) + jitter;
        console.log(`Waiting ${Math.round(delay/1000)}s before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Transaction failed after all retries');
}