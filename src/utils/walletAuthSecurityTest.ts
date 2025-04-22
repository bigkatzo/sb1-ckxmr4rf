/**
 * Wallet Authentication Security Test
 * 
 * This utility helps verify that the security fixes for wallet authentication
 * are properly implemented and enforced.
 */

/**
 * Test the wallet authentication system against various attack scenarios
 * @param walletAddress The wallet address to test
 * @param walletAuthToken The authentication token for the wallet
 * @returns Results of security tests
 */
export async function testWalletAuthSecurity(walletAddress: string, walletAuthToken: string) {
  // Get Supabase URL and key from environment  
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL or key not found in environment variables');
  }

  // A different wallet address that shouldn't be accessible
  const differentWallet = 'DIFFERENT' + walletAddress.substring(9);
  
  // Base auth headers with API key but no wallet auth
  const baseHeaders = {
    'Content-Type': 'application/json',
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`
  };

  // Complete wallet auth headers
  const walletAuthHeaders = {
    ...baseHeaders,
    'X-Wallet-Address': walletAddress,
    'X-Wallet-Auth-Token': walletAuthToken
  };

  // Headers with wallet address but no auth token
  const walletAddressOnlyHeaders = {
    ...baseHeaders,
    'X-Wallet-Address': walletAddress
    // No X-Wallet-Auth-Token
  };

  // Security tests
  try {
    const results = [];
    
    // Test 1: Can we access our own wallet data with proper auth? (Should succeed)
    const ownWalletTest = await fetch(
      `${supabaseUrl}/rest/v1/rpc/test_wallet_token_validation?wallet_addr=${encodeURIComponent(walletAddress)}&token_type=valid`,
      {
        method: 'GET',
        headers: walletAuthHeaders
      }
    );
    
    const ownWalletResult = ownWalletTest.ok ? await ownWalletTest.json() : null;
    const isOwnWalletAllowed = ownWalletResult && ownWalletResult.would_access_be_allowed === 'true';
    
    results.push({
      test: 'Access own wallet data with proper auth',
      expected: 'Success',
      actual: isOwnWalletAllowed ? 'Success' : 'Failed', 
      passed: isOwnWalletAllowed,
      details: ownWalletResult
    });
    
    // Test 2: Try to access a different wallet's data (Should fail)
    const differentWalletTest = await fetch(
      `${supabaseUrl}/rest/v1/rpc/test_wallet_token_validation?wallet_addr=${encodeURIComponent(differentWallet)}&token_type=valid`,
      {
        method: 'GET',
        headers: walletAuthHeaders
      }
    );
    
    const differentWalletResult = differentWalletTest.ok ? await differentWalletTest.json() : null;
    const isDifferentWalletAllowed = differentWalletResult && differentWalletResult.would_access_be_allowed === 'true';
    
    results.push({
      test: 'Access different wallet data',
      expected: 'Failure',
      actual: isDifferentWalletAllowed ? 'Success (SECURITY ISSUE)' : 'Failed (GOOD)',
      passed: !isDifferentWalletAllowed,
      details: differentWalletResult
    });
    
    // Test 3: Try without auth token (Should fail)
    const noTokenTest = await fetch(
      `${supabaseUrl}/rest/v1/rpc/test_wallet_token_validation?wallet_addr=${encodeURIComponent(walletAddress)}&token_type=missing`,
      {
        method: 'GET',
        headers: walletAddressOnlyHeaders
      }
    );
    
    const noTokenResult = noTokenTest.ok ? await noTokenTest.json() : null;
    const isNoTokenAllowed = noTokenResult && noTokenResult.would_access_be_allowed === 'true';
    
    results.push({
      test: 'Access without auth token',
      expected: 'Failure',
      actual: isNoTokenAllowed ? 'Success with data (SECURITY ISSUE)' : 'Failed (GOOD)',
      passed: !isNoTokenAllowed,
      status: noTokenTest.status,
      details: noTokenResult
    });

    // Test 4: Try with invalid token format (Should fail)
    const invalidTokenTest = await fetch(
      `${supabaseUrl}/rest/v1/rpc/test_wallet_token_validation?wallet_addr=${encodeURIComponent(walletAddress)}&token_type=invalid_format`,
      {
        method: 'GET',
        headers: {
          ...baseHeaders,
          'X-Wallet-Address': walletAddress,
          'X-Wallet-Auth-Token': 'INVALID_FORMAT_TOKEN'
        }
      }
    );
    
    const invalidTokenResult = invalidTokenTest.ok ? await invalidTokenTest.json() : null;
    const isInvalidTokenAllowed = invalidTokenResult && invalidTokenResult.would_access_be_allowed === 'true';
    
    results.push({
      test: 'Access with invalid token format',
      expected: 'Failure',
      actual: isInvalidTokenAllowed ? 'Success with data (SECURITY ISSUE)' : 'Failed (GOOD)',
      passed: !isInvalidTokenAllowed,
      details: invalidTokenResult
    });
    
    // Overall security assessment
    const securityPassed = results.every(r => r.passed);
    
    return {
      timestamp: new Date().toISOString(),
      walletAddress,
      securityPassed,
      results,
      version: '1.2' // Updated version with direct testing
    };
  } catch (error) {
    console.error('Error testing wallet authentication security:', error);
    return {
      timestamp: new Date().toISOString(),
      walletAddress,
      securityPassed: false,
      error: error instanceof Error ? error.message : String(error),
      version: '1.2'
    };
  }
} 