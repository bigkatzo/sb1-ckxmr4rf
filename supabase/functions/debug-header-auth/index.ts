// @ts-ignore -- Deno-specific imports
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.5.0";

// CORS headers to allow requests from any origin
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

// Handle OPTIONS preflight request
const handleOptions = () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
};

serve(async (req) => {
  console.log("Function invoked with method:", req.method);
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return handleOptions();
  }
  
  try {
    // Get the raw request body as text for debugging
    const rawBody = await req.text();
    console.log("Raw request body:", rawBody);
    
    // Try to parse as JSON
    let body;
    try {
      body = JSON.parse(rawBody);
      console.log("Parsed request body:", body);
    } catch (e) {
      console.error("Failed to parse JSON:", e);
      // Continue anyway with an empty object
      body = {};
    }
    
    // Extract wallet address and token from the request body
    const walletAddress = body.wallet || body.walletAddress || "";
    const authToken = body.token || body.authToken || "";
    
    if (!walletAddress) {
      return new Response(
        JSON.stringify({
          error: "Missing wallet address",
          message: "Please provide a wallet address to debug"
        }),
        { 
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        }
      );
    }
    
    // Get Supabase URL and anon key from environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") || ""; // Use anon key instead of service role
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase credentials");
    }
    
    // Create headers with wallet address and auth token
    const headers: Record<string, string> = {
      "X-Wallet-Address": walletAddress
    };
    
    if (authToken) {
      headers["X-Wallet-Auth-Token"] = authToken;
    }
    
    // Create client with headers
    const client = createClient(supabaseUrl, supabaseKey, {
      global: { headers }
    });
    
    // Test debug function
    console.log("Calling debug_wallet_header_verification function...");
    const { data: debugData, error: debugError } = await client.rpc(
      "debug_wallet_header_verification", 
      { target_wallet: walletAddress }
    );
    
    // Check if the function exists
    let functionExists = true;
    if (debugError && debugError.message.includes("does not exist")) {
      functionExists = false;
    }
    
    // Try to fetch orders
    console.log("Testing access to user_orders...");
    const { data: ordersData, error: ordersError } = await client
      .from("user_orders")
      .select("id, order_number, wallet_address")
      .eq("wallet_address", walletAddress)
      .limit(5);
    
    // Get raw headers to debug
    const rawHeaders = {};
    for (const [key, value] of Object.entries(headers)) {
      rawHeaders[key] = value;
    }
    
    // Create response combining all debug info
    const response = {
      wallet_address: walletAddress,
      auth_token: authToken ? `${authToken.substring(0, 20)}...` : null,
      headers_used: rawHeaders,
      debug_function: {
        exists: functionExists,
        data: debugData,
        error: debugError ? debugError.message : null
      },
      orders_test: {
        success: !ordersError,
        error: ordersError ? ordersError.message : null,
        count: ordersData?.length || 0,
        samples: ordersData || []
      }
    };
    
    return new Response(
      JSON.stringify(response, null, 2),
      { 
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    );
  } catch (error) {
    console.error("Unhandled error:", error);
    
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error.message
      }),
      { 
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    );
  }
}); 