import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
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
    const walletPubKey = new PublicKey(walletAddress);
    const tokenMintPubKey = new PublicKey(tokenMintAddress);

    // Get the associated token account for the wallet
    const tokenAccount = await getAssociatedTokenAddress(tokenMintPubKey, walletPubKey);

    try {
      // Fetch balance of the token account
      const balanceInfo = await SOLANA_CONNECTION.getTokenAccountBalance(tokenAccount);
      const tokenBalance = parseFloat(balanceInfo.value.amount);

      return {
        isValid: tokenBalance >= minAmount,
        balance: tokenBalance
      };
    } catch (error) {
      // Token account doesn't exist - user has never held this token
      return {
        isValid: false,
        error: 'No token account found. You need to acquire the required tokens first.',
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