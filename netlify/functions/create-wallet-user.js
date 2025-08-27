const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  // Handle CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { walletAddress } = JSON.parse(event.body);

    if (!walletAddress) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Missing wallet address' })
      };
    }

    // Create Supabase client with service role key
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Missing Supabase configuration' })
      };
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Create unique email and password for wallet
    const walletEmail = `${walletAddress}@wallet.local`;
    const walletPassword = `wallet_${walletAddress.slice(0, 16)}`;

    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase.auth.admin.getUserByEmail(walletEmail);
    
    if (checkError && !checkError.message.includes('User not found')) {
      console.error('Error checking existing user:', checkError);
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Error checking existing user' })
      };
    }

    let userId;

    if (existingUser) {
      // User exists, get their ID
      userId = existingUser.user.id;
      console.log('User already exists:', userId);
    } else {
      // Create new user with email confirmation disabled
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: walletEmail,
        password: walletPassword,
        email_confirm: true, // Confirm email immediately
        user_metadata: {
          wallet_address: walletAddress,
          auth_type: 'wallet',
          provider: 'privy'
        },
        app_metadata: {
          provider: 'wallet',
          providers: ['wallet'],
          wallet_address: walletAddress,
          auth_type: 'wallet'
        }
      });

      if (createError) {
        console.error('Error creating user:', createError);
        return {
          statusCode: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ error: 'Error creating user' })
        };
      }

      userId = newUser.user.id;
      console.log('New user created:', userId);
    }

    // Create a session for the user
    const { data: authSession, error: authError } = await supabase.auth.admin.createSession({
      user_id: userId
    });

    if (authError) {
      console.error('Error creating session:', authError);
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Error creating session' })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        user: authSession.user,
        session: authSession.session
      })
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
