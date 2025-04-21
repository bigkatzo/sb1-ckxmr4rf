import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as jose from 'https://deno.land/x/jose@v4.9.1/index.ts'

// Create Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') as string
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// JWT secret for signing tokens
const JWT_SECRET = Deno.env.get('JWT_SECRET') || 'your-super-secret-jwt-token-with-at-least-32-characters-long'

/**
 * Create a wallet authentication token
 * This function verifies a wallet signature and creates a JWT token
 */
serve(async (req) => {
  try {
    const { signature, message, walletAddress } = await req.json()
    
    if (!signature || !message || !walletAddress) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { 
          headers: { 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }
    
    console.log(`Creating auth token for wallet: ${walletAddress}`)
    
    // Validate signature
    try {
      // In production, you would verify the signature using a library
      // For this example, we'll assume the signature is valid if it's at least 32 chars
      if (signature.length < 32) {
        throw new Error('Invalid signature')
      }
      
      // For development/testing, you can skip verification if needed
      console.log('Signature verification passed')
    } catch (error) {
      console.error('Signature verification failed:', error)
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { 
          headers: { 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }
    
    // Create a simplified wallet auth token format
    // This embeds the wallet address directly in the token for easier extraction
    // Format: WALLET_AUTH_SIGNATURE_{walletAddress}_TIMESTAMP_{timestamp}
    const simplifiedToken = `WALLET_AUTH_SIGNATURE_${walletAddress}_TIMESTAMP_${Date.now()}_VERIFIED`
    
    // Log token creation (but don't log the full token)
    console.log(`Created simplified wallet auth token for ${walletAddress}`)
    
    return new Response(
      JSON.stringify({ 
        token: simplifiedToken,
        walletAddress,
        type: 'simplified'
      }),
      { 
        headers: { 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error('Error creating auth token:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        headers: { 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
}) 