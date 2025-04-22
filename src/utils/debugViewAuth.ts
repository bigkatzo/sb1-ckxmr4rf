/**
 * Utility to debug view authentication issues
 */
export async function debugViewAuth(walletAddress: string, walletAuthToken: string) {
  // Get Supabase URL and key from environment
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL or key not found in environment variables');
  }

  const results: Record<string, any> = {};

  // 1. First check our diagnostic function
  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/rpc/diagnose_header_auth`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'X-Wallet-Address': walletAddress,
          'X-Wallet-Auth-Token': walletAuthToken
        },
        body: JSON.stringify({})
      }
    );
    
    if (!response.ok) {
      results.diagnosticError = `Failed with status: ${response.status}`;
    } else {
      results.diagnostics = await response.json();
    }
  } catch (err) {
    results.diagnosticError = err instanceof Error ? err.message : String(err);
  }

  // 2. Test the view directly
  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/user_orders?select=id,order_number,status,wallet_address&limit=3`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'X-Wallet-Address': walletAddress,
          'X-Wallet-Auth-Token': walletAuthToken
        }
      }
    );
    
    if (!response.ok) {
      results.viewQueryError = `Failed with status: ${response.status}`;
    } else {
      const data = await response.json();
      results.viewQuery = {
        success: true,
        count: Array.isArray(data) ? data.length : 0,
        data: Array.isArray(data) ? data : []
      };
    }
  } catch (err) {
    results.viewQueryError = err instanceof Error ? err.message : String(err);
  }

  // 3. Test our view test function
  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/rpc/test_user_orders_view`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'X-Wallet-Address': walletAddress,
          'X-Wallet-Auth-Token': walletAuthToken
        },
        body: JSON.stringify({})
      }
    );
    
    if (!response.ok) {
      results.testFunctionError = `Failed with status: ${response.status}`;
    } else {
      results.testFunction = await response.json();
    }
  } catch (err) {
    results.testFunctionError = err instanceof Error ? err.message : String(err);
  }

  // 4. Add a timestamp
  results.timestamp = new Date().toISOString();
  results.walletAddress = walletAddress;
  results.hasToken = Boolean(walletAuthToken);

  return results;
} 