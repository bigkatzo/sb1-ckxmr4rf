import { PublicKey, Connection, ConnectionConfig } from '@solana/web3.js';
import { getAssociatedTokenAddress, getMint, TokenAccountNotFoundError, TokenInvalidAccountOwnerError, getAccount } from '@solana/spl-token';
import { SOLANA_CONNECTION } from '../config/solana';

// Cache structure to store recent balance checks
interface CacheEntry {
  result: TokenVerificationResult;
  timestamp: number;
}

const balanceCache = new Map<string, CacheEntry>();
const CACHE_TTL = 30000; // 30 seconds TTL

// Get cache key for a verification request
function getCacheKey(walletAddress: string, tokenMintAddress: string, minAmount: number): string {
  return `${walletAddress}:${tokenMintAddress}:${minAmount}`;
}

export interface TokenVerificationResult {
  isValid: boolean;
  error?: string;
  balance?: number;
}

// Validate Solana address format
function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

export async function verifyTokenHolding(
  walletAddress: string,
  tokenMintAddress: string,
  minAmount: number
): Promise<TokenVerificationResult> {
  // Input validation
  if (!walletAddress || !isValidSolanaAddress(walletAddress)) {
    return {
      isValid: false,
      error: 'Invalid wallet address format',
      balance: 0
    };
  }

  if (!tokenMintAddress || !isValidSolanaAddress(tokenMintAddress)) {
    return {
      isValid: false,
      error: 'Invalid token mint address format',
      balance: 0
    };
  }

  if (typeof minAmount !== 'number' || minAmount < 0) {
    return {
      isValid: false,
      error: 'Invalid minimum amount specified',
      balance: 0
    };
  }

  try {
    const walletPubKey = new PublicKey(walletAddress);
    const tokenMintPubKey = new PublicKey(tokenMintAddress);

    // Configure connection with timeout
    const connectionConfig: ConnectionConfig = {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 30000, // 30 seconds
    };
    
    const connection = new Connection(
      SOLANA_CONNECTION.rpcEndpoint,
      connectionConfig
    );

    // Get token mint info to check decimals
    const mintInfo = await getMint(connection, tokenMintPubKey);
    
    // Get the associated token account for the wallet
    const tokenAccount = await getAssociatedTokenAddress(tokenMintPubKey, walletPubKey);

    try {
      const cacheKey = getCacheKey(walletAddress, tokenMintAddress, minAmount);
      const cachedEntry = balanceCache.get(cacheKey);
      
      // Return cached result if still valid
      if (cachedEntry && (Date.now() - cachedEntry.timestamp) < CACHE_TTL) {
        return cachedEntry.result;
      }

      // First verify the token account exists and is valid
      const account = await getAccount(connection, tokenAccount);
      
      console.log('Token account info:', {
        address: tokenAccount.toBase58(),
        mint: account.mint.toBase58(),
        owner: account.owner.toBase58(),
        amount: account.amount.toString()
      });

      // Get raw amount and convert based on decimals
      const rawBalance = Number(account.amount);
      const tokenBalance = rawBalance / Math.pow(10, mintInfo.decimals);

      const result = {
        isValid: tokenBalance >= minAmount,
        balance: tokenBalance,
        error: tokenBalance >= minAmount ? undefined : 
               `Insufficient tokens. You have ${tokenBalance} but need ${minAmount} tokens.`
      };

      // Cache the result
      balanceCache.set(cacheKey, {
        result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      // Handle specific token account errors
      if (error instanceof TokenAccountNotFoundError || error instanceof TokenInvalidAccountOwnerError) {
        console.error('Token account error:', {
          error,
          tokenAccount: tokenAccount.toBase58(),
          wallet: walletAddress,
          mint: tokenMintAddress
        });
        return {
          isValid: false,
          error: `Unable to verify token balance. Please make sure you have the correct tokens in your wallet.`,
          balance: 0
        };
      }
      
      // Handle other errors
      console.error('Error checking token balance:', error);
      return {
        isValid: false,
        error: 'Failed to check token balance. Please try again.',
        balance: 0
      };
    }
  } catch (error) {
    console.error('Error verifying token balance:', error);
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Failed to verify token balance',
      balance: 0
    };
  }
}