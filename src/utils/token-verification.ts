import { PublicKey, Connection, ConnectionConfig } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { SOLANA_CONNECTION } from '../config/solana';

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

    // Get the associated token account for the wallet
    const tokenAccount = await getAssociatedTokenAddress(tokenMintPubKey, walletPubKey);

    try {
      // Fetch balance of the token account
      const balanceInfo = await connection.getTokenAccountBalance(tokenAccount);
      const tokenBalance = balanceInfo.value.uiAmount || 0;

      return {
        isValid: tokenBalance >= minAmount,
        balance: tokenBalance,
        error: tokenBalance >= minAmount ? undefined : 
               `Insufficient tokens. You have ${tokenBalance} but need ${minAmount} tokens.`
      };
    } catch (error) {
      // Token account doesn't exist - user has never held this token
      return {
        isValid: false,
        error: `No tokens found. You need to buy the required (${minAmount}) tokens first.`,
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