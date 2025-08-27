-- Disable email confirmation for wallet users and set up simpler authentication
BEGIN;

-- Create a function to create wallet users without email confirmation
CREATE OR REPLACE FUNCTION create_wallet_user(wallet_address text)
RETURNS uuid AS $$
DECLARE
  user_id uuid;
  wallet_email text;
  wallet_password text;
BEGIN
  -- Create unique email and password for wallet
  wallet_email := wallet_address || '@wallet.local';
  wallet_password := 'wallet_' || substring(wallet_address, 1, 16);
  
  -- Check if user already exists
  SELECT id INTO user_id
  FROM auth.users
  WHERE email = wallet_email;
  
  -- If user doesn't exist, create one
  IF user_id IS NULL THEN
    -- Insert user directly into auth.users table
    INSERT INTO auth.users (
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change_token_new,
      email_change,
      recovery_token,
      email_change_token_current,
      phone_change,
      phone_change_token,
      confirmed_at,
      email_change_confirm_status,
      banned_until,
      reauthentication_token,
      is_sso_user,
      deleted_at,
      is_anonymous,
      providers
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      wallet_email,
      crypt(wallet_password, gen_salt('bf', 6)),
      now(), -- Email confirmed immediately
      now(),
      jsonb_build_object(
        'provider', 'wallet',
        'providers', ARRAY['wallet'],
        'wallet_address', wallet_address,
        'auth_type', 'wallet'
      ),
      jsonb_build_object(
        'wallet_address', wallet_address,
        'auth_type', 'wallet',
        'provider', 'privy'
      ),
      now(),
      now(),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      now(), -- Confirmed immediately
      0,
      null,
      '',
      false,
      null,
      false,
      ARRAY['wallet']
    )
    RETURNING id INTO user_id;
    
    -- Create identity
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      user_id,
      user_id,
      jsonb_build_object(
        'sub', user_id::text,
        'email', wallet_email,
        'wallet_address', wallet_address,
        'email_verified', true
      ),
      'wallet',
      now(),
      now(),
      now()
    );
  END IF;
  
  RETURN user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_wallet_user(text) TO authenticated, anon;

-- Create a function to get or create wallet user and return session
CREATE OR REPLACE FUNCTION get_wallet_session(wallet_address text)
RETURNS jsonb AS $$
DECLARE
  user_id uuid;
  wallet_email text;
  wallet_password text;
  session_data jsonb;
BEGIN
  -- Create or get wallet user
  user_id := create_wallet_user(wallet_address);
  
  -- Get wallet email and password
  wallet_email := wallet_address || '@wallet.local';
  wallet_password := 'wallet_' || substring(wallet_address, 1, 16);
  
  -- Create a simple session token
  session_data := jsonb_build_object(
    'access_token', 'wallet_session_' || wallet_address || '_' || extract(epoch from now())::text,
    'refresh_token', 'wallet_refresh_' || wallet_address || '_' || extract(epoch from now())::text,
    'expires_in', 3600,
    'expires_at', extract(epoch from now() + interval '1 hour')::bigint,
    'token_type', 'bearer',
    'user', jsonb_build_object(
      'id', user_id,
      'email', wallet_email,
      'user_metadata', jsonb_build_object(
        'wallet_address', wallet_address,
        'auth_type', 'wallet',
        'provider', 'privy'
      ),
      'app_metadata', jsonb_build_object(
        'provider', 'wallet',
        'providers', ARRAY['wallet'],
        'wallet_address', wallet_address,
        'auth_type', 'wallet'
      )
    )
  );
  
  RETURN session_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_wallet_session(text) TO authenticated, anon;

COMMIT;
