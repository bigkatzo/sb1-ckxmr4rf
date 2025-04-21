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
    console.log('Edge function started, attempting to create Supabase client');
    const projectUrl = Deno.env.get('PROJECT_URL') || '';
    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') || '';
    
    console.log(`Project URL ${projectUrl ? 'is set' : 'is NOT set'}`);
    console.log(`Service key ${serviceKey ? 'is set' : 'is NOT set'}`);
    
    if (!projectUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error - missing environment variables' }),
        { 
          status: 500, 
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json' 
          } 
        }
      );
    }
    
    const supabaseClient = createClient(projectUrl, serviceKey);

    // Get and log the request body
    let reqBody;
    try {
      reqBody = await req.json();
      console.log('Request body parsed successfully:', {
        wallet: reqBody.wallet ? `${reqBody.wallet.substring(0, 8)}...` : 'not provided',
        hasSignature: !!reqBody.signature,
        hasMessage: !!reqBody.message
      });
    } catch (error) {
      console.error('Error parsing request body:', error);
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { 
          status: 400, 
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    const { wallet, signature, message } = reqBody;

    // Basic validation
    if (!wallet || !signature || !message) {
      console.error('Missing required parameters');
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { 
          status: 400, 
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    // Simplified authentication - just check wallet address format
    if (!wallet.match(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)) {
      console.error('Invalid wallet address format');
      return new Response(
        JSON.stringify({ error: 'Invalid wallet address format' }),
        { 
          status: 400, 
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    // Generate a unique email for wallet users
    const walletEmail = `wallet.${wallet}@walletauth.storedotfun.com`;
    
    // Find or create a user for this wallet
    let { data: user, error: userError } = await supabaseClient
      .from('users')
      .select('id')
      .eq('wallet_address', wallet)
      .maybeSingle();

    if (userError) {
      console.error('Error finding user:', userError);
    }

    let userId: string | undefined;
    
    if (!user) {
      // Create a new user for this wallet
      console.log('User not found, creating new user');
      const { data: newUser, error: createError } = await supabaseClient
        .from('users')
        .insert({ wallet_address: wallet })
        .select('id')
        .single();
        
      if (createError) {
        console.error('Error creating user:', createError);
        return new Response(
          JSON.stringify({ error: 'Failed to create user', details: createError.message }),
          { 
            status: 500, 
            headers: { 
              ...corsHeaders,
              'Content-Type': 'application/json' 
            } 
          }
        );
      }
      
      userId = newUser?.id;
    } else {
      userId = user?.id;
    }
    
    console.log(`User ID: ${userId}`);

    // Create a JWT token for this wallet
    console.log('Creating auth token');
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
    });

    if (authError) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Authentication failed', details: authError.message }),
        { 
          status: 500, 
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    // Get session token using magic link
    console.log('Generating link');
    const { data: sessionData, error: sessionError } = await supabaseClient.auth.admin.generateLink({
      type: 'magiclink',
      email: walletEmail,
    });

    if (sessionError) {
      console.error('Session error:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Failed to create session', details: sessionError.message }),
        { 
          status: 500, 
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    // Return the token for authentication
    console.log('Authentication completed successfully');
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
    );
  } catch (error) {
    console.error('Server error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) }),
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