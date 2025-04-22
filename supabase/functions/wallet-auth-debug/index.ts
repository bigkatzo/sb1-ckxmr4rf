import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  
  try {
    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Extract token
    const token = authHeader.replace('Bearer ', '');
    
    // Parse request
    const { wallet = null } = await req.json().catch(() => ({}));
    
    // Create Supabase client with admin rights
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    
    // Create a user client with the token
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_ANON_KEY') || '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    
    // Get basic JWT info without verification (for debugging)
    let jwtInfo = {};
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        jwtInfo = {
          sub: payload.sub,
          wallet_address: payload.wallet_address,
          user_metadata: payload.user_metadata,
          app_metadata: payload.app_metadata,
          exp: new Date(payload.exp * 1000).toISOString(),
          token_prefix: `${token.substring(0, 10)}...`
        };
      }
    } catch (e) {
      jwtInfo = { error: 'Error parsing JWT', details: e.message };
    }
    
    // Get wallet address to check
    const targetWallet = wallet || jwtInfo?.wallet_address || jwtInfo?.user_metadata?.wallet_address;
    
    // Run database debug functions if wallet is available
    let dbDebugInfo = null;
    if (targetWallet) {
      try {
        const { data, error } = await supabaseClient.rpc('debug_wallet_auth_check', {
          target_wallet: targetWallet
        });
        
        if (error) throw error;
        dbDebugInfo = data;
      } catch (e) {
        dbDebugInfo = { error: 'Error running database debug function', details: e.message };
      }
    }
    
    // Run a direct query to count orders for this wallet
    let directOrdersCount = null;
    if (targetWallet) {
      try {
        const { count, error } = await supabaseAdmin
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('wallet_address', targetWallet);
          
        if (error) throw error;
        directOrdersCount = count;
      } catch (e) {
        directOrdersCount = { error: 'Error counting orders', details: e.message };
      }
    }
    
    // Collect sample orders to verify data
    let sampleOrders = [];
    if (targetWallet) {
      try {
        const { data, error } = await supabaseAdmin
          .from('orders')
          .select('id, order_number, wallet_address, status, created_at')
          .eq('wallet_address', targetWallet)
          .limit(5);
          
        if (error) throw error;
        sampleOrders = data;
      } catch (e) {
        sampleOrders = [{ error: 'Error fetching sample orders', details: e.message }];
      }
    }
    
    // Try to get orders via the user_orders view
    let userOrdersResult = [];
    try {
      const { data, error } = await supabaseClient
        .from('user_orders')
        .select('id, order_number')
        .limit(5);
        
      if (error) throw error;
      userOrdersResult = data;
    } catch (e) {
      userOrdersResult = [{ error: 'Error fetching from user_orders view', details: e.message }];
    }
    
    // Return all diagnostics
    const response = {
      jwt_info: jwtInfo,
      target_wallet: targetWallet,
      direct_orders_count: directOrdersCount,
      sample_orders: sampleOrders,
      user_orders_result: userOrdersResult,
      db_debug_info: dbDebugInfo
    };
    
    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}); 