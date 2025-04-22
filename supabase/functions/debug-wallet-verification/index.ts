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
    
    // Extract the wallet address from the request body
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
    
    // Create a Supabase client with admin privilages to access functions
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase credentials");
    }
    
    // Create the admin client
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Create a client with the wallet address and auth token in headers
    // This simulates what the client app would send
    const headers: Record<string, string> = {};
    headers["X-Wallet-Address"] = walletAddress;
    
    if (authToken) {
      headers["X-Wallet-Auth-Token"] = authToken;
    }
    
    const testClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers }
    });
    
    // Call the debug_wallet_verification function
    const { data: debugData, error: debugError } = await supabase.rpc(
      "debug_wallet_verification",
      { target_wallet: walletAddress }
    );
    
    if (debugError) {
      throw new Error(`Debug function error: ${debugError.message}`);
    }
    
    // Test a direct query to user_orders to see if it works
    const { data: testData, error: testError } = await testClient
      .from("user_orders")
      .select("id, order_number")
      .limit(1);
      
    // Compile all the debug info
    const debugInfo = {
      wallet_address: walletAddress,
      auth_token: authToken ? `${authToken.substring(0, 20)}...` : null,
      verification_details: debugData,
      test_query: {
        success: !testError,
        error: testError ? testError.message : null,
        data_available: testData && testData.length > 0,
        sample_data: testData && testData.length > 0 ? testData[0] : null
      },
      headers_sent: headers
    };
    
    return new Response(
      JSON.stringify(debugInfo), 
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    );
  } catch (error) {
    console.error("Unhandled error:", error.message, error.stack);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error.message,
        stack: error.stack
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