import { WhitelistVerificationResult } from '../types';

export function verifyWhitelistAccess(
  walletAddress: string,
  whitelistAddresses: string
): WhitelistVerificationResult {
  try {
    // Split the comma-separated list and trim whitespace
    const whitelistedWallets = whitelistAddresses
      .split(',')
      .map(address => address.trim())
      .filter(address => address.length > 0);

    // Check if wallet is in the whitelist
    const isWhitelisted = whitelistedWallets.includes(walletAddress);

    return {
      isValid: isWhitelisted,
      error: isWhitelisted ? undefined : 'Wallet not whitelisted'
    };
  } catch (error) {
    console.error('Error verifying whitelist:', error);
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Failed to verify whitelist access'
    };
  }
} 