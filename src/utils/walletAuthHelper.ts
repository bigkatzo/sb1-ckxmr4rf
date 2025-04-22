/**
 * Wallet Authentication Helper Utilities
 * 
 * Provides functions to test and debug wallet authentication
 */

/**
 * Tests the wallet authentication system by calling various diagnostic RPC functions
 * @param walletAddress The wallet address to test
 * @param walletAuthToken The authentication token for the wallet
 * @returns Detailed diagnostic information about the authentication system
 */
export async function testWalletAuth(walletAddress: string, walletAuthToken: string) {
  // Get Supabase URL and key from environment
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL or key not found in environment variables');
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'X-Wallet-Address': walletAddress,
    'X-Wallet-Auth-Token': walletAuthToken
  };

  // Run all tests in parallel
  try {
    const [
      basicAuth,
      scenarios,
      dashboard,
      authStatus,
      orderCount
    ] = await Promise.all([
      // Test basic authentication
      fetch(
        `${supabaseUrl}/rest/v1/rpc/test_wallet_auth`,
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ wallet_addr: walletAddress })
        }
      ).then(r => r.ok ? r.json() : { error: `Failed with status: ${r.status}` }),
      
      // Test authentication scenarios
      fetch(
        `${supabaseUrl}/rest/v1/rpc/test_wallet_auth_scenarios`,
        {
          method: 'POST',
          headers: authHeaders
        }
      ).then(r => r.ok ? r.json() : { error: `Failed with status: ${r.status}` }),
      
      // Get auth system dashboard
      fetch(
        `${supabaseUrl}/rest/v1/auth_system_dashboard?select=*`,
        {
          method: 'GET',
          headers: authHeaders
        }
      ).then(r => r.ok ? r.json() : { error: `Failed with status: ${r.status}` }),
      
      // Get detailed auth status
      fetch(
        `${supabaseUrl}/rest/v1/rpc/debug_auth_status`,
        {
          method: 'POST',
          headers: authHeaders
        }
      ).then(r => r.ok ? r.json() : { error: `Failed with status: ${r.status}` }),
      
      // Count orders that should be accessible
      fetch(
        `${supabaseUrl}/rest/v1/user_orders?select=count`,
        {
          method: 'GET',
          headers: {
            ...authHeaders,
            'Prefer': 'count=exact'
          }
        }
      ).then(r => r.ok ? r.headers.get('content-range')?.split('/')[1] || '0' : '0')
      .then(count => parseInt(count, 10))
    ]);

    return {
      timestamp: new Date().toISOString(),
      walletAddress,
      hasAuthToken: !!walletAuthToken,
      basicAuth,
      scenarios,
      dashboard: Array.isArray(dashboard) && dashboard.length > 0 ? dashboard[0] : null,
      authStatus,
      orderCount,
      success: basicAuth && !basicAuth.error && orderCount > 0,
      version: '1.0'
    };
  } catch (error) {
    console.error('Error testing wallet authentication:', error);
    return {
      timestamp: new Date().toISOString(),
      walletAddress,
      hasAuthToken: !!walletAuthToken,
      error: error instanceof Error ? error.message : String(error),
      success: false,
      version: '1.0'
    };
  }
}

/**
 * Validates the security of the wallet authentication system
 * Attempts various attacks to ensure they are properly blocked
 * @param walletAddress The wallet address to test
 * @param walletAuthToken The authentication token for the wallet
 * @returns Security test results
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
  
  // Base auth headers
  const authHeaders = {
    'Content-Type': 'application/json',
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'X-Wallet-Address': walletAddress,
    'X-Wallet-Auth-Token': walletAuthToken
  };

  // Security tests
  try {
    const results = [];
    
    // Test 1: Can we access our own wallet data? (Should succeed)
    const ownWalletTest = await fetch(
      `${supabaseUrl}/rest/v1/user_orders?select=count`,
      {
        method: 'GET',
        headers: {
          ...authHeaders,
          'Prefer': 'count=exact'
        }
      }
    );
    
    results.push({
      test: 'Access own wallet data',
      expected: 'Success',
      actual: ownWalletTest.ok ? 'Success' : 'Failed',
      passed: ownWalletTest.ok,
      details: ownWalletTest.ok ? 
        await ownWalletTest.json() : 
        { status: ownWalletTest.status, statusText: ownWalletTest.statusText }
    });
    
    // Test 2: Try to access a different wallet's data (Should fail)
    const differentWalletTest = await fetch(
      `${supabaseUrl}/rest/v1/orders?select=*&wallet_address=eq.${differentWallet}`,
      {
        method: 'GET',
        headers: authHeaders
      }
    );
    
    results.push({
      test: 'Access different wallet data',
      expected: 'Failure',
      actual: differentWalletTest.ok ? 'Success (SECURITY ISSUE)' : 'Failed (GOOD)',
      passed: !differentWalletTest.ok,
      status: differentWalletTest.status
    });
    
    // Test 3: Try without auth token (Should fail)
    const noTokenTest = await fetch(
      `${supabaseUrl}/rest/v1/user_orders?select=count`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'X-Wallet-Address': walletAddress
          // No X-Wallet-Auth-Token
        }
      }
    );
    
    results.push({
      test: 'Access without auth token',
      expected: 'Failure or empty',
      actual: noTokenTest.ok ? 
        (await noTokenTest.json()).length > 0 ? 
          'Success with data (SECURITY ISSUE)' : 
          'Success but empty (OK)' 
        : 'Failed (GOOD)',
      passed: !noTokenTest.ok || (noTokenTest.ok && (await noTokenTest.json()).length === 0),
      status: noTokenTest.status
    });
    
    // Overall security assessment
    const securityPassed = results.every(r => r.passed);
    
    return {
      timestamp: new Date().toISOString(),
      walletAddress,
      securityPassed,
      results,
      version: '1.0'
    };
  } catch (error) {
    console.error('Error testing wallet authentication security:', error);
    return {
      timestamp: new Date().toISOString(),
      walletAddress,
      securityPassed: false,
      error: error instanceof Error ? error.message : String(error),
      version: '1.0'
    };
  }
}

/**
 * Exports wallet authentication information for debugging
 * @param walletAddress The wallet address to export for
 * @param walletAuthToken The authentication token for the wallet
 * @returns Exportable authentication information
 */
export async function exportWalletAuthInfo(walletAddress: string, walletAuthToken: string) {
  try {
    // Run the full wallet auth test
    const authInfo = await testWalletAuth(walletAddress, walletAuthToken);
    
    // Serialize to a downloadable JSON
    const jsonString = JSON.stringify(authInfo, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Create a link and trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = `wallet-auth-debug-${walletAddress.substring(0, 8)}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    // Clean up
    URL.revokeObjectURL(url);
    
    return {
      success: true,
      message: 'Wallet authentication debug information exported successfully'
    };
  } catch (error) {
    console.error('Error exporting wallet authentication info:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error)
    };
  }
} 