-- Drop existing function
DROP FUNCTION IF EXISTS create_user_with_username(text, text, text);

-- Create improved user creation function
CREATE OR REPLACE FUNCTION create_user_with_username(
  p_username text,
  p_password text,
  p_role text DEFAULT 'user'
)
RETURNS uuid AS $$
DECLARE
  v_user_id uuid;
  v_email text;
  v_now timestamptz;
BEGIN
  -- Only allow admin420 to create users
  IF NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'email', '') != 'admin420@merchant.local' THEN
    RAISE EXCEPTION 'Only admin420 can create users';
  END IF;

  -- Set current timestamp
  v_now := now();
  
  -- Create email by appending @merchant.local
  v_email := p_username || '@merchant.local';

  -- Create user in auth.users with all required fields
  INSERT INTO auth.users (
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,    -- Automatically confirm email
    raw_app_meta_data,     -- Add role and email provider
    raw_user_meta_data,    -- Mirror metadata
    role,                  -- Set to authenticated
    created_at,
    updated_at,
    last_sign_in_at,      -- Set initial sign in time
    confirmation_sent_at   -- Required for email confirmation
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_email,
    crypt(p_password, gen_salt('bf')),  -- Properly hash password
    v_now,                              -- Confirm email immediately
    jsonb_build_object(
      'role', p_role,
      'provider', 'email'
    ),
    jsonb_build_object(
      'role', p_role,
      'provider', 'email'
    ),
    'authenticated',
    v_now,
    v_now,
    v_now,                             -- Set last sign in
    v_now                              -- Set confirmation sent
  )
  RETURNING id INTO v_user_id;

  -- Create matching profile in user_profiles
  INSERT INTO user_profiles (
    id,
    role,
    created_at,
    updated_at
  )
  VALUES (
    v_user_id,
    p_role,
    v_now,
    v_now
  );

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION create_user_with_username(text, text, text) TO authenticated; 