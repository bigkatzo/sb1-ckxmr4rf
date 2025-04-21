import { supabase } from '../lib/supabase';

/**
 * Utility to verify that order security is correctly implemented
 * This is useful for debugging and confirming that the user only sees their own orders
 */
export async function verifyOrderSecurity() {
  try {
    // Get JWT debugging info
    const { data: jwtDebug } = await supabase.rpc('debug_auth_jwt');
    console.log('JWT debug info:', jwtDebug);
    
    // Call the security verification function we created
    const { data: securityCheck, error } = await supabase
      .from('user_orders_security_check')
      .select('*')
      .single();
      
    if (error) {
      console.error('Error checking order security:', error);
      return {
        secure: false,
        error: error.message,
        details: null
      };
    }
    
    console.log('Security check results:', securityCheck);
    
    // Determine if everything is secure
    const isSecure = securityCheck.jwt_wallet_match && securityCheck.filtered_correctly;
    
    // Return security status and details
    return {
      secure: isSecure,
      error: isSecure ? null : 'Security issue detected in order filtering',
      details: securityCheck
    };
  } catch (err) {
    console.error('Exception in security verification:', err);
    return {
      secure: false,
      error: err instanceof Error ? err.message : 'Unknown error checking security',
      details: null
    };
  }
}

/**
 * Debugs the order security implementation by checking JWT and wallet access
 * This is useful for verifying that RLS is working correctly
 */
export const debugOrderSecurity = async () => {
  // Only run in development
  if (import.meta.env.PROD) {
    return;
  }

  console.log('Starting order security verification');

  try {
    // Get session data
    const { data: sessionData } = await supabase.auth.getSession();
    console.log('Current session:', sessionData?.session ? 'Found' : 'Not found');
    console.log('JWT token present:', sessionData?.session?.access_token ? 'Yes' : 'No');
    
    // Extract wallet address from JWT if available
    const walletAddressInJWT = sessionData?.session?.user?.user_metadata?.wallet_address;
    if (walletAddressInJWT) {
      console.log('Wallet address in JWT claims:', walletAddressInJWT);
    } else {
      console.warn('No wallet address found in JWT user_metadata');
    }

    // Use the debug function if available
    let debugData;
    try {
      const { data } = await supabase.rpc('debug_jwt_wallet');
      debugData = data;
      console.log('JWT debug info:', data);
    } catch (e) {
      console.warn('JWT debug function not available:', e instanceof Error ? e.message : String(e));
    }

    // Test user_orders view access
    const { data: ordersViewTest, error: viewError } = await supabase
      .from('user_orders')
      .select('count(*)', { count: 'exact', head: true });

    if (viewError) {
      console.error('Error accessing user_orders view:', viewError.message);
    } else {
      console.log('user_orders view access:', 'Success', { count: ordersViewTest });
    }

    // Test direct RLS policy on orders table
    const { data: ordersRlsTest, error: rlsError } = await supabase
      .from('orders')
      .select('count(*)', { count: 'exact', head: true })
      .eq('wallet_address', walletAddressInJWT || '');

    if (rlsError) {
      console.error('Error with direct orders RLS policy:', rlsError.message);
    } else {
      console.log('Direct orders RLS access:', 'Success', { count: ordersRlsTest });
    }

    // Try the wallet sync function if available and our wallet isn't properly recognized
    if (debugData && !debugData.wallet_access_works && walletAddressInJWT) {
      try {
        const { data: syncResult } = await supabase.rpc('sync_wallet_to_jwt', {
          wallet_addr: walletAddressInJWT
        });
        console.log('Wallet sync attempt result:', syncResult);
        
        // Check if sync improved access
        if (syncResult?.success) {
          const { data: afterSync } = await supabase.rpc('debug_jwt_wallet');
          console.log('JWT status after sync:', afterSync);
        }
      } catch (e) {
        console.warn('Wallet sync function not available:', e instanceof Error ? e.message : String(e));
      }
    }

    return {
      success: true,
      walletInJwt: !!walletAddressInJWT,
      viewAccess: !viewError,
      directAccess: !rlsError
    };
  } catch (error) {
    console.error('Error during security verification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}; 