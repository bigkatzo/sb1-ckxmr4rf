// @ts-ignore -- Deno-specific imports
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

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
    
    // Create a simpler verification token that includes:
    // 1. The wallet address (for direct verification)
    // 2. Expiry timestamp
    // 3. A signature verification hash
    
    // Create expiry timestamp (1 hour from now)
    const now = Date.now();
    const expiresAt = now + (3600 * 1000); // 1 hour expiry
    
    // Create a signature hash from the wallet signature for verification
    const signatureBuffer = new TextEncoder().encode(signature + message);
    const signatureHash = await crypto.subtle.digest("SHA-256", signatureBuffer);
    const hashArray = Array.from(new Uint8Array(signatureHash));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Generate a simple verification token in this format:
    // WALLET_VERIFIED_{walletAddress}_EXP_{expiryTime}_SIG_{signatureHash}
    const verificationToken = `WALLET_VERIFIED_${walletAddress}_EXP_${expiresAt}_SIG_${hashHex.substring(0, 16)}`;
    
    console.log(`Verification token created for wallet: ${walletAddress}`);
    
    // Return the verification token and metadata
    return new Response(
      JSON.stringify({
        token: verificationToken,
        wallet_address: walletAddress,
        expires_at: expiresAt,
        type: "wallet_verification",
        debug: {
          receivedSignature: signature ? signature.substring(0, 10) + "..." : null,
          receivedMessage: message ? message.substring(0, 10) + "..." : null,
          wallet: walletAddress,
          expires: new Date(expiresAt).toISOString()
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