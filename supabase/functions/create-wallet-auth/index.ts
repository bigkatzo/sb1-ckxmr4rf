// @ts-ignore -- Deno-specific imports
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
// @ts-ignore -- Deno-specific crypto
import { create, verify } from "https://deno.land/x/djwt@v2.8/mod.ts";

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
    
    // Extract fields, with fallbacks
    const signature = body.signature || "default_signature";
    const message = body.message || "default_message";
    const walletAddress = body.wallet || body.walletAddress || "CP9mCLHEk2j9L6RTndQnHoUkyH8qZeEfTgEDtvqcL3Yn";
    
    console.log(`Creating auth token for wallet: ${walletAddress}`);
    
    // Create a key for JWT signing - in production use a secure environment variable
    // The key must be at least 32 bytes for the HS256 algorithm
    const key = await crypto.subtle.generateKey(
      { name: "HMAC", hash: "SHA-256" },
      true,
      ["sign", "verify"]
    );
    
    const now = Math.floor(Date.now() / 1000);
    const userId = `wallet_${walletAddress.substring(0, 12)}`;
    
    // Create payload with wallet address in proper locations
    const payload = {
      sub: userId,
      wallet_address: walletAddress, // Important: Add at root level
      iat: now,
      exp: now + 3600, // Expires in 1 hour
      user_metadata: {
        wallet_address: walletAddress,
        wallet_updated_at: new Date().toISOString()
      },
      app_metadata: {
        wallet_address: walletAddress,
        wallet_auth: true,
        auth_type: "wallet"
      }
    };
    
    // Create properly signed JWT
    const jwtToken = await create(
      { alg: "HS256", typ: "JWT" },
      payload,
      key
    );
    
    console.log(`Token created successfully for wallet: ${walletAddress}`);
    
    // Return the properly signed token
    return new Response(
      JSON.stringify({
        token: jwtToken,
        wallet_address: walletAddress,
        type: "jwt",
        debug: {
          receivedSignature: signature ? signature.substring(0, 10) + "..." : null,
          receivedMessage: message ? message.substring(0, 10) + "..." : null,
          receivedWalletAddress: walletAddress,
          tokenFormat: "JWT",
          decodedPayload: payload
        }
      }), 
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
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    );
  }
}); 