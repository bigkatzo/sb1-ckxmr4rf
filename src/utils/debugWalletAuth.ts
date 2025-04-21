import { supabase } from '../lib/supabase';

/**
 * Debug utility to help diagnose wallet authentication issues
 * @param walletAddress The wallet address to check
 * @param walletAuthToken Optional wallet auth token to verify
 */
export async function debugWalletAuth(walletAddress: string, walletAuthToken?: string | null) {
  try {
    console.log('Debugging wallet authentication for:', walletAddress);
    
    // Check for token in header if provided
    if (walletAuthToken) {
      // Temporarily set auth token if not in session
      const { data: sessionCheck } = await supabase.auth.getSession();
      
      if (!sessionCheck?.session) {
        console.log('No session found, setting provided token temporarily');
        await supabase.auth.setSession({
          access_token: walletAuthToken,
          refresh_token: ''
        });
      }
    }
    
    // Get current session info
    const { data: sessionData } = await supabase.auth.getSession();
    console.log('Current session:', {
      exists: Boolean(sessionData?.session),
      user: sessionData?.session?.user ? {
        id: sessionData.session.user.id,
        email: sessionData.session.user.email,
        hasMetadata: Boolean(sessionData.session.user.user_metadata),
        hasAppMetadata: Boolean(sessionData.session.user.app_metadata)
      } : null
    });
    
    // Check if JWT contains wallet information
    let jwtWalletInfo = {
      inUserMetadata: false,
      inAppMetadata: false,
      atRoot: false,
      extractedWallet: null as string | null
    };
    
    if (sessionData?.session?.user) {
      const { user } = sessionData.session;
      
      if (user.user_metadata?.wallet_address) {
        jwtWalletInfo.inUserMetadata = true;
        jwtWalletInfo.extractedWallet = user.user_metadata.wallet_address;
      } else if (user.app_metadata?.wallet_address) {
        jwtWalletInfo.inAppMetadata = true;
        jwtWalletInfo.extractedWallet = user.app_metadata.wallet_address;
      } else if ((user as any).wallet_address) {
        jwtWalletInfo.atRoot = true;
        jwtWalletInfo.extractedWallet = (user as any).wallet_address;
      }
      
      console.log('JWT wallet extraction:', jwtWalletInfo);
    }
    
    // Try to call debug JWT wallet function
    try {
      const { data: debugData, error: debugError } = await supabase.rpc('debug_jwt_wallet');
      
      if (debugError) {
        console.error('Error calling debug_jwt_wallet function:', debugError);
      } else {
        console.log('Database JWT debugging data:', debugData);
      }
    } catch (err) {
      console.error('Exception calling debug function:', err);
    }
    
    // Try to access user_orders view
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from('user_orders')
        .select('count(*)', { count: 'exact', head: true });
        
      console.log('user_orders view access test:', {
        error: ordersError ? ordersError.message : null,
        count: ordersData !== null ? 'Available' : 'Not available'
      });
    } catch (viewErr) {
      console.error('Exception testing view access:', viewErr);
    }
    
    // Try direct orders query with wallet
    try {
      const { count: ordersCount, error: directError } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('wallet_address', walletAddress);
        
      console.log('Direct orders query for wallet:', {
        wallet: walletAddress,
        count: ordersCount,
        error: directError ? directError.message : null
      });
    } catch (directErr) {
      console.error('Exception querying orders directly:', directErr);
    }
    
    // Try debug view if available
    try {
      const { data: debugViewData, error: debugViewError } = await supabase
        .from('debug_user_orders')
        .select('*')
        .eq('wallet_address', walletAddress)
        .limit(1);
        
      if (debugViewError) {
        console.log('Debug view not available or error:', debugViewError.message);
      } else {
        console.log('Debug view data for wallet:', debugViewData);
      }
    } catch (debugViewErr) {
      console.log('Exception or debug view not available:', debugViewErr);
    }
    
    return {
      success: true,
      walletAddress,
      jwtWalletInfo,
      sessionExists: Boolean(sessionData?.session)
    };
  } catch (error) {
    console.error('Error in debugWalletAuth:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      walletAddress
    };
  }
} 