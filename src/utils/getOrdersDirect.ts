/**
 * Utility to fetch orders directly using fetch API instead of Supabase SDK
 * This approach is more robust against SDK-specific parsing errors
 */
export async function getOrdersDirect(walletAddress: string, walletAuthToken: string) {
  // Get Supabase URL and key from environment
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL or key not found in environment variables');
  }

  // First try user_orders view
  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/user_orders?select=*&order=created_at.desc`,
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
      throw new Error(`Orders query failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      return {
        data,
        source: 'user_orders_view',
        error: null
      };
    }
  } catch (viewErr) {
    console.error('Error fetching from user_orders view:', viewErr);
    // Continue to fallback method
  }

  // If view didn't work, try direct orders table
  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/orders?select=*,products(name),collections(name)&wallet_address=eq.${walletAddress}&order=created_at.desc`,
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
      throw new Error(`Direct orders query failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    return {
      data,
      source: 'orders_table',
      error: null
    };
  } catch (directErr) {
    console.error('Error fetching from orders table:', directErr);
    
    // Last resort, try RPC function
    try {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/rpc/get_wallet_orders_direct`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'X-Wallet-Address': walletAddress,
            'X-Wallet-Auth-Token': walletAuthToken
          },
          body: JSON.stringify({ wallet_addr: walletAddress })
        }
      );
      
      if (!response.ok) {
        throw new Error(`Wallet orders RPC failed with status: ${response.status}`);
      }
      
      const data = await response.json();
      return {
        data,
        source: 'rpc_function',
        error: null
      };
    } catch (rpcErr) {
      return {
        data: [],
        source: null,
        error: rpcErr instanceof Error ? rpcErr.message : String(rpcErr)
      };
    }
  }
} 