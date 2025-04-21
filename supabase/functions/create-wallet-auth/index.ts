import { serve } from 'https://deno.land/std@0.131.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0'
import * as base58 from 'https://deno.land/x/base58@v0.2.0/mod.ts';
import * as ed25519 from 'https://deno.land/x/ed25519@1.6.0/mod.ts';
import { decode as decodeBase64 } from 'https://deno.land/std@0.83.0/encoding/base64.ts';

/**
 * Verify a Solana wallet signature
 */
async function verifySignature(
  message: string,
  signature: string,
  publicKey: string
): Promise<boolean> {
  try {
    // Convert the signature and public key from strings to Uint8Arrays
    const signatureBytes = base58.decode(signature);
    const publicKeyBytes = base58.decode(publicKey);
    const messageBytes = new TextEncoder().encode(message);

    // Verify the signature using ed25519
    return await ed25519.verify(signatureBytes, messageBytes, publicKeyBytes);
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

serve(async (req) => {
  try {
    // Create a Supabase client with the project details
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') as string,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string
    )

    // Get the request body
    const { wallet, signature, message, timestamp } = await req.json()

    // Basic validation
    if (!wallet || !signature || !message || !timestamp) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Validate timestamp isn't too old (prevent replay attacks)
    const currentTime = Date.now()
    const messageTime = Number(timestamp)
    const timeWindow = 5 * 60 * 1000 // 5 minutes in milliseconds
    
    if (isNaN(messageTime) || currentTime - messageTime > timeWindow) {
      return new Response(
        JSON.stringify({ error: 'Authentication request expired' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Convert the signature from base64 back to its original form
    const signatureBytes = decodeBase64(signature);
    const signatureBase58 = base58.encode(signatureBytes);

    // Verify the signature
    const isValid = await verifySignature(message, signatureBase58, wallet)

    if (!isValid) {
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Find or create a user for this wallet
    let { data: user, error: userError } = await supabaseClient
      .from('users')
      .select('id')
      .eq('wallet_address', wallet)
      .maybeSingle()

    if (userError) {
      console.error('Error finding user:', userError)
    }

    let userId
    
    if (!user) {
      // Create a new user for this wallet
      const { data: newUser, error: createError } = await supabaseClient
        .from('users')
        .insert({ wallet_address: wallet })
        .select('id')
        .single()
        
      if (createError) {
        console.error('Error creating user:', createError)
        return new Response(
          JSON.stringify({ error: 'Failed to create user' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
      }
      
      userId = newUser.id
    } else {
      userId = user.id
    }

    // Create a custom JWT token
    const { data: tokenData, error: tokenError } = await supabaseClient.auth.admin.createUser({
      email: `${wallet}@wallet.auth`,
      password: crypto.randomUUID(), // Random password, user will never use it
      user_metadata: {
        wallet_address: wallet
      },
      app_metadata: {
        wallet_address: wallet,
        wallet_auth: true,
        wallet_auth_time: Date.now()
      }
    })

    if (tokenError) {
      console.error('Error creating token:', tokenError)
      return new Response(
        JSON.stringify({ error: 'Failed to create auth token' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get the session token for this user
    const { data: sessionData, error: sessionError } = await supabaseClient.auth.admin.generateLink({
      type: 'magiclink',
      email: `${wallet}@wallet.auth`,
    })

    if (sessionError) {
      console.error('Error creating session:', sessionError)
      return new Response(
        JSON.stringify({ error: 'Failed to create session' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        token: sessionData.properties.access_token,
        user: {
          id: userId,
          wallet: wallet
        }
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    )
  } catch (error) {
    console.error('Server error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}) 