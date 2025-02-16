-- Drop existing function
DROP FUNCTION IF EXISTS create_user_with_username(text, text, user_role);

-- Create function with proper field settings
CREATE OR REPLACE FUNCTION create_user_with_username(
  p_username text,
  p_password text,
  p_role user_role DEFAULT 'user'
)
RETURNS uuid
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
  v_now timestamptz;
BEGIN
  -- Check admin authorization
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can create users';
  END IF;

  -- Set current timestamp
  v_now := now();
  
  -- Create email
  v_email := p_username || '@merchant.local';

  -- Create user with all fields explicitly set
  INSERT INTO auth.users (
    instance_id,
    id,
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
    username,
    providers
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    v_email,
    crypt(p_password, gen_salt('bf', 10)),
    v_now,
    v_now,
    jsonb_build_object(
      'provider', 'email',
      'providers', ARRAY['email'],
      'role', p_role::text
    ),
    jsonb_build_object(
      'email_verified', true
    ),
    v_now,
    v_now,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    v_now,
    0,
    null,
    '',
    false,
    null,
    false,
    p_username,
    ARRAY['email']
  )
  RETURNING id INTO v_user_id;

  -- Create auth identity
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES (
    v_user_id,
    v_user_id,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', v_email,
      'email_verified', true
    ),
    'email',
    v_now,
    v_now,
    v_now
  );

  -- Create profile with proper role
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

  -- Verify critical fields
  IF NOT EXISTS (
    SELECT 1 
    FROM auth.users 
    WHERE id = v_user_id 
    AND aud = 'authenticated'
    AND created_at IS NOT NULL
    AND updated_at IS NOT NULL
    AND providers @> ARRAY['email']
    AND raw_app_meta_data->>'provider' = 'email'
  ) THEN
    RAISE EXCEPTION 'User creation verification failed: Critical fields not set correctly';
  END IF;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION create_user_with_username(text, text, user_role) TO authenticated; 