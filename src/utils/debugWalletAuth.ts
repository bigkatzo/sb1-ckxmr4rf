import { supabase } from '../lib/supabase';

/**
 * Runs a comprehensive wallet authentication debug process
 * to diagnose issues with JWT tokens and database access
 */
export async function debugWalletAuth(walletAddress: string, walletAuthToken: string | null): Promise<any> {
  try {
    console.log('Running wallet auth debug for wallet:', walletAddress);
    
    // Initial client-side checks
    const clientChecks = {
      hasWalletAddress: Boolean(walletAddress),
      hasWalletAuthToken: Boolean(walletAuthToken),
      tokenType: walletAuthToken ? (
        walletAuthToken.includes('WALLET_AUTH') ? 'custom-wallet-jwt' : 'standard-jwt'
      ) : 'none'
    };
    
    // If no wallet token, we can't proceed with server-side checks
    if (!walletAuthToken) {
      return {
        ...clientChecks,
        success: false,
        error: 'No wallet auth token available'
      };
    }
    
    // Set the auth token in Supabase for subsequent calls
    await supabase.auth.setSession({
      access_token: walletAuthToken,
      refresh_token: ''
    });
    
    // Call our dedicated wallet-auth-debug Edge Function
    const { data: apiDebugData, error: apiDebugError } = await supabase.functions.invoke(
      'wallet-auth-debug',
      {
        body: { wallet: walletAddress }
      }
    );
    
    if (apiDebugError) {
      throw new Error(`API Debug Error: ${apiDebugError.message}`);
    }
    
    // Direct orders check - directly count orders for this wallet
    const { count: directCount, error: countError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('wallet_address', walletAddress);
      
    // User orders view check
    const { data: viewData, error: viewError } = await supabase
      .from('user_orders')
      .select('id, order_number')
      .limit(5);
    
    // Try calling our database debug function
    const { data: dbFunctionData, error: dbFunctionError } = await supabase.rpc(
      'debug_wallet_auth_check',
      { target_wallet: walletAddress }
    );
    
    // Final report combining all diagnostics
    return {
      ...clientChecks,
      success: true,
      api_debug: apiDebugData,
      direct_query: {
        count: directCount,
        error: countError ? countError.message : null
      },
      view_query: {
        data: viewData,
        count: viewData?.length,
        error: viewError ? viewError.message : null
      },
      db_function: {
        data: dbFunctionData,
        error: dbFunctionError ? dbFunctionError.message : null
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