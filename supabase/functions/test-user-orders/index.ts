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
    
    // Parse JWT to get wallet address
    let walletAddress = null;
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        walletAddress = payload.wallet_address || (payload.user_metadata && payload.user_metadata.wallet_address);
      } else if (token.includes('WALLET_AUTH_SIGNATURE')) {
        // Extract from custom format
        const parts = token.split('_');
        if (parts.length >= 3) {
          walletAddress = parts[2];
        }
      }
    } catch (e) {
      console.error('Error parsing JWT:', e);
    }
    
    // Create Supabase client with admin rights to bypass RLS for diagnostics
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
    
    // Test query against user_orders view
    const { data: userOrdersData, error: userOrdersError } = await supabaseClient
      .from('user_orders')
      .select('*')
      .limit(5);
    
    // Direct query for orders with admin client
    const { data: directOrdersData, error: directOrdersError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('wallet_address', walletAddress || '')
      .limit(5);
    
    // Try with debug function
    let debugResult = null;
    try {
      const { data, error } = await supabaseClient.rpc('debug_jwt_wallet_extraction');
      if (!error) {
        debugResult = data;
      }
    } catch (e) {
      console.error('Error running debug function:', e);
    }
    
    // Return all diagnostics
    return new Response(
      JSON.stringify({
        success: true,
        token_type: token.includes('WALLET_AUTH_SIGNATURE') ? 'custom' : 'standard',
        wallet_address: walletAddress,
        user_orders_query: {
          data: userOrdersData,
          count: userOrdersData?.length || 0,
          error: userOrdersError ? userOrdersError.message : null
        },
        direct_orders_query: {
          data: directOrdersData,
          count: directOrdersData?.length || 0,
          error: directOrdersError ? directOrdersError.message : null
        },
        jwt_debug: debugResult
      }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : String(error)
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
}); 