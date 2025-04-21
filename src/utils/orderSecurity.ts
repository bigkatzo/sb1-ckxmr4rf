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
 * Adds security verification to the OrdersPage
 * Can be called from the component to debug security issues
 */
export async function debugOrderSecurity() {
  console.group('🔒 Order Security Verification');
  try {
    const securityResult = await verifyOrderSecurity();
    
    if (securityResult.secure) {
      console.log('✅ Orders are properly secured');
    } else {
      console.error('❌ Security issue detected:', securityResult.error);
    }
    
    if (securityResult.details) {
      console.log('Current wallet:', securityResult.details.current_wallet);
      console.log('All wallet addresses match JWT:', securityResult.details.jwt_wallet_match);
      console.log('Total orders in database:', securityResult.details.orders_count);
      console.log('Orders visible to user:', securityResult.details.user_orders_count);
      console.log('Filtering working correctly:', securityResult.details.filtered_correctly);
      console.log('All wallets in system:', securityResult.details.all_wallets_in_orders);
      console.log('Wallets in user_orders:', securityResult.details.all_wallets_in_user_orders);
    }
    
    return securityResult;
  } catch (error) {
    console.error('Error running security debug:', error);
    return {
      secure: false,
      error: 'Error running security verification',
      details: null
    };
  } finally {
    console.groupEnd();
  }
} 