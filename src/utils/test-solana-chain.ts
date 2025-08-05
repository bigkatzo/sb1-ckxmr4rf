/**
 * Test utility to verify Solana chain identification
 * This helps debug chain ID issues with Phantom wallet
 */

export const SOLANA_CHAIN_IDS = {
  SOLANA_STRING: 'solana',
  SOLANA_NUMERIC: '7565164',
  SOLANA_LEGACY: '1399811150', // Old incorrect ID
} as const;

export function testSolanaChainId(chainId: any): {
  isValid: boolean;
  type: 'string' | 'numeric' | 'legacy' | 'unknown';
  message: string;
} {
  const chainIdStr = chainId?.toString();
  
  if (!chainIdStr) {
    return {
      isValid: false,
      type: 'unknown',
      message: 'No chain ID provided'
    };
  }
  
  switch (chainIdStr) {
    case SOLANA_CHAIN_IDS.SOLANA_STRING:
      return {
        isValid: true,
        type: 'string',
        message: '✅ Valid Solana chain ID (string format)'
      };
    
    case SOLANA_CHAIN_IDS.SOLANA_NUMERIC:
      return {
        isValid: true,
        type: 'numeric',
        message: '✅ Valid Solana chain ID (numeric format)'
      };
    
    case SOLANA_CHAIN_IDS.SOLANA_LEGACY:
      return {
        isValid: false,
        type: 'legacy',
        message: '❌ Legacy Solana chain ID (1399811150) - not supported by Phantom'
      };
    
    default:
      return {
        isValid: false,
        type: 'unknown',
        message: `❌ Unknown chain ID: ${chainIdStr}`
      };
  }
}

export function validateSolanaConnection(user: any): {
  isValid: boolean;
  chainId: string | undefined;
  chainType: string | undefined;
  testResult: ReturnType<typeof testSolanaChainId>;
  message: string;
} {
  if (!user?.wallet) {
    return {
      isValid: false,
      chainId: undefined,
      chainType: undefined,
      testResult: testSolanaChainId(undefined),
      message: 'No wallet connection found'
    };
  }
  
  const chainId = user.wallet.chainId;
  const chainType = user.wallet.chainType;
  const testResult = testSolanaChainId(chainId);
  
  const isValid = testResult.isValid && chainType === 'solana';
  
  let message = testResult.message;
  if (chainType !== 'solana') {
    message += ` | ❌ Wrong chain type: ${chainType} (expected: solana)`;
  }
  
  if (isValid) {
    message += ' | ✅ Valid Solana connection';
  }
  
  return {
    isValid,
    chainId: chainId?.toString(),
    chainType,
    testResult,
    message
  };
}

// Debug function to log all chain information
export function debugChainInfo(user: any): void {
  console.log('🔍 Chain Debug Information:');
  console.log('User object:', user);
  
  if (user?.wallet) {
    console.log('Wallet info:', {
      chainId: user.wallet.chainId,
      chainType: user.wallet.chainType,
      address: user.wallet.address,
      walletClientType: user.wallet.walletClientType
    });
    
    const validation = validateSolanaConnection(user);
    console.log('Validation result:', validation);
    
    // Test all possible Solana chain IDs
    console.log('Testing all Solana chain IDs:');
    Object.values(SOLANA_CHAIN_IDS).forEach(id => {
      const result = testSolanaChainId(id);
      console.log(`  ${id}:`, result.message);
    });
  } else {
    console.log('No wallet connection found');
  }
} 