import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { corsHeaders, handleCors } from './cors.ts';

serve(async (req) => {
  // Handle CORS preflight requests
  const corsResponse = handleCors(req);
  if (corsResponse) {
    return corsResponse;
  }

  try {
    // Create a Supabase client with the project details
    const supabaseClient = createClient(
      // Using renamed environment variables to avoid restrictions
      Deno.env.get('PROJECT_URL') || '',
      Deno.env.get('SERVICE_ROLE_KEY') || ''
    )

    // Get the request body
    const { wallet, signature, message } = await req.json()

    // Basic validation
    if (!wallet || !signature || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { 
          status: 400, 
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json' 
          } 
        }
      )
    }

    // In a real implementation, this would verify the signature
    // For now, we'll assume the wallet address is valid and create a session
    console.log('Creating auth for wallet:', wallet);
    console.log('Signature:', signature.slice(0, 20) + '...');

    // Generate a unique email for wallet users
    const walletEmail = `wallet.${wallet}@walletauth.storedotfun.com`

    // Find or create a user for this wallet
    let { data: user, error: userError } = await supabaseClient
      .from('users')
      .select('id')
      .eq('wallet_address', wallet)
      .maybeSingle()

    if (userError) {
      console.error('Error finding user:', userError)
    }

    let userId: string | undefined;
    
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
          { 
            status: 500, 
            headers: { 
              ...corsHeaders,
              'Content-Type': 'application/json' 
            } 
          }
        )
      }
      
      userId = newUser?.id;
    } else {
      userId = user?.id;
    }

    // Create a JWT token for this wallet
    // Using the admin API to create a user
    const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
      email: walletEmail,
      password: crypto.randomUUID(), // Random password
      user_metadata: {
        wallet_address: wallet,
        auth_method: 'wallet'
      },
      app_metadata: {
        wallet_address: wallet,
        wallet_auth: true,
        auth_type: 'wallet'
      }
    })

    if (authError) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { 
          status: 500, 
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json' 
          } 
        }
      )
    }

    // Get session token using magic link
    const { data: sessionData, error: sessionError } = await supabaseClient.auth.admin.generateLink({
      type: 'magiclink',
      email: walletEmail,
    })

    if (sessionError) {
      console.error('Session error:', sessionError)
      return new Response(
        JSON.stringify({ error: 'Failed to create session' }),
        { 
          status: 500, 
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json' 
          } 
        }
      )
    }

    // Return the token for authentication
    return new Response(
      JSON.stringify({ 
        token: sessionData.properties.access_token,
        user: {
          id: userId,
          wallet: wallet,
          auth_type: 'wallet'
        }
      }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    )
  } catch (error) {
    console.error('Server error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
}) 