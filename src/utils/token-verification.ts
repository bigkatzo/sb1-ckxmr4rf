import { PublicKey } from '@solana/web3.js';
import { SOLANA_CONNECTION } from '../config/solana';

export interface TokenVerificationResult {
  isValid: boolean;
  error?: string;
  balance?: number;
}

export async function verifyTokenHolding(
  walletAddress: string,
  tokenMintAddress: string,
  minAmount: number
): Promise<TokenVerificationResult> {
  try {
    // Basic input validation
    if (!walletAddress || !tokenMintAddress || minAmount < 0) {
      return { isValid: false, error: 'Invalid input parameters', balance: 0 };
    }

    const connection = SOLANA_CONNECTION;
    
    // Get all token accounts for this wallet and mint
    const accounts = await connection.getTokenAccountsByOwner(
      new PublicKey(walletAddress),
      { mint: new PublicKey(tokenMintAddress) }
    );

    // If no accounts found, user doesn't have any tokens
    if (accounts.value.length === 0) {
      return {
        isValid: false,
        error: `No tokens found. You need ${minAmount} tokens to proceed.`,
        balance: 0
      };
    }

    // Get balance of the first account (there should typically only be one)
    const balance = await connection.getTokenAccountBalance(accounts.value[0].pubkey);
    const tokenBalance = Number(balance.value.uiAmount || 0);

    return {
      isValid: tokenBalance >= minAmount,
      balance: tokenBalance,
      error: tokenBalance >= minAmount ? undefined : 
             `Insufficient tokens. You have ${tokenBalance} but need ${minAmount} tokens.`
    };
  } catch (error) {
    console.error('Error verifying token balance:', error);
    return {
      isValid: false,
      error: 'Failed to verify token balance',
      balance: 0
    };
  }
}