import { supabase } from '../lib/supabase';

/**
 * Runs a comprehensive wallet authentication debug process
 * to diagnose issues with JWT tokens and database access using direct fetch calls
 * instead of Supabase SDK to avoid potential parsing issues.
 */
export async function debugWalletAuth(walletAddress: string, walletAuthToken: string | null): Promise<any> {
  try {
    console.log('Running wallet auth debug for wallet:', walletAddress);
    
    // Get Supabase URL and key from environment
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL or key not found in environment variables');
    }
    
    // Initial client-side checks
    const clientChecks = {
      hasWalletAddress: Boolean(walletAddress),
      hasWalletAuthToken: Boolean(walletAuthToken),
      tokenType: walletAuthToken ? (
        walletAuthToken.includes('WALLET_VERIFIED_') || walletAuthToken.includes('WALLET_AUTH_') 
          ? 'custom-wallet-token' 
          : 'standard-jwt'
      ) : 'none',
      supabaseConfig: {
        hasUrl: Boolean(supabaseUrl),
        hasKey: Boolean(supabaseKey)
      }
    };
    
    // If no wallet token, we can't proceed with server-side checks
    if (!walletAuthToken) {
      return {
        ...clientChecks,
        success: false,
        error: 'No wallet auth token available'
      };
    }

    // Use direct fetch approach for all RPC calls instead of Supabase SDK
    // This approach is more resilient to parsing errors like "h is not a function"
    
    // 1. Call the unified wallet_auth_debug function
    let unifiedDebugData;
    try {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/rpc/wallet_auth_debug`,
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
        throw new Error(`Unified debug failed with status: ${response.status}`);
      }
      
      unifiedDebugData = await response.json();
    } catch (unifiedErr) {
      console.error('Error in unified debug:', unifiedErr);
      unifiedDebugData = { error: unifiedErr instanceof Error ? unifiedErr.message : String(unifiedErr) };
    }
    
    // 2. Call direct orders function
    let directOrdersData;
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
        throw new Error(`Direct orders query failed with status: ${response.status}`);
      }
      
      directOrdersData = await response.json();
    } catch (directErr) {
      console.error('Error in direct orders:', directErr);
      directOrdersData = { error: directErr instanceof Error ? directErr.message : String(directErr) };
    }
    
    // 3. Test headers debug function
    let headersDebugData;
    try {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/rpc/debug_wallet_headers_raw`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'X-Wallet-Address': walletAddress,
            'X-Wallet-Auth-Token': walletAuthToken
          },
          body: JSON.stringify({ test_wallet: walletAddress })
        }
      );
      
      if (!response.ok) {
        throw new Error(`Headers debug failed with status: ${response.status}`);
      }
      
      headersDebugData = await response.json();
    } catch (headersErr) {
      console.error('Error in headers debug:', headersErr);
      headersDebugData = { error: headersErr instanceof Error ? headersErr.message : String(headersErr) };
    }
    
    // Direct query using fetch API (similar to what works in the debug page)
    let userOrdersData;
    try {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/user_orders?select=id,order_number,wallet_address&limit=5`,
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
        throw new Error(`User orders query failed with status: ${response.status}`);
      }
      
      userOrdersData = await response.json();
    } catch (viewErr) {
      console.error('Error in user orders view:', viewErr);
      userOrdersData = { error: viewErr instanceof Error ? viewErr.message : String(viewErr) };
    }
    
    // Final report combining all diagnostics
    return {
      ...clientChecks,
      success: true,
      unified_debug: unifiedDebugData,
      direct_orders: {
        data: directOrdersData,
        count: Array.isArray(directOrdersData) ? directOrdersData.length : null
      },
      headers_debug: headersDebugData,
      user_orders_view: {
        data: userOrdersData,
        count: Array.isArray(userOrdersData) ? userOrdersData.length : null
      }
    };
  } catch (err) {
    console.error('Error in wallet auth debug:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err)
    };
  }
} 