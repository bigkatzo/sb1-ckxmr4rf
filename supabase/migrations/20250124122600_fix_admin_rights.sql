-- Drop existing functions
DROP FUNCTION IF EXISTS create_user_with_username(text, text, user_role);

-- Create function with proper admin rights
CREATE OR REPLACE FUNCTION create_user_with_username(
  p_username text,
  p_password text,
  p_role user_role DEFAULT 'user'
)
RETURNS uuid
SECURITY DEFINER
SET search_path = auth, public
SET role = 'service_role'  -- This ensures we have proper admin rights
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
    invited_at,
    confirmation_token,
    confirmation_sent_at,
    recovery_token,
    recovery_sent_at,
    email_change_token_new,
    email_change,
    email_change_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    phone,
    phone_confirmed_at,
    phone_change,
    phone_change_token,
    phone_change_sent_at,
    confirmed_at,
    email_change_token_current,
    email_change_confirm_status,
    banned_until,
    reauthentication_token,
    reauthentication_sent_at,
    is_sso_user,
    deleted_at,
    is_anonymous,
    username,
    providers
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',  -- instance_id
    gen_random_uuid(),                        -- id
    'authenticated',                          -- aud
    'authenticated',                          -- role
    v_email,                                 -- email
    crypt(p_password, gen_salt('bf', 6)),    -- encrypted_password
    v_now,                                   -- email_confirmed_at
    null,                                    -- invited_at
    '',                                      -- confirmation_token
    v_now,                                   -- confirmation_sent_at
    '',                                      -- recovery_token
    null,                                    -- recovery_sent_at
    '',                                      -- email_change_token_new
    '',                                      -- email_change
    null,                                    -- email_change_sent_at
    v_now,                                   -- last_sign_in_at
    jsonb_build_object(                      -- raw_app_meta_data
      'provider', 'email',
      'providers', ARRAY['email'],
      'role', p_role::text
    ),
    jsonb_build_object(                      -- raw_user_meta_data
      'email_verified', true,
      'role', p_role::text
    ),
    false,                                   -- is_super_admin
    v_now,                                   -- created_at
    v_now,                                   -- updated_at
    null,                                    -- phone
    null,                                    -- phone_confirmed_at
    '',                                      -- phone_change
    '',                                      -- phone_change_token
    null,                                    -- phone_change_sent_at
    v_now,                                   -- confirmed_at
    '',                                      -- email_change_token_current
    0,                                       -- email_change_confirm_status
    null,                                    -- banned_until
    '',                                      -- reauthentication_token
    null,                                    -- reauthentication_sent_at
    false,                                   -- is_sso_user
    null,                                    -- deleted_at
    false,                                   -- is_anonymous
    p_username,                              -- username
    ARRAY['email']                          -- providers
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

  -- Create profile
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

  -- Fix any null or incorrect values
  UPDATE auth.users
  SET 
    aud = 'authenticated',
    created_at = COALESCE(created_at, v_now),
    updated_at = COALESCE(updated_at, v_now),
    last_sign_in_at = COALESCE(last_sign_in_at, v_now),
    confirmation_sent_at = COALESCE(confirmation_sent_at, v_now),
    providers = ARRAY['email'],
    raw_app_meta_data = jsonb_build_object(
      'provider', 'email',
      'providers', ARRAY['email'],
      'role', p_role::text
    ),
    raw_user_meta_data = jsonb_build_object(
      'email_verified', true,
      'role', p_role::text
    )
  WHERE id = v_user_id
  AND (
    aud IS NULL 
    OR created_at IS NULL 
    OR updated_at IS NULL 
    OR last_sign_in_at IS NULL
    OR confirmation_sent_at IS NULL
    OR providers = '{}'::text[]
    OR raw_app_meta_data->>'provider' != 'email'
  );

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION create_user_with_username(text, text, user_role) TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_with_username(text, text, user_role) TO service_role;

-- Ensure service_role has proper permissions
GRANT ALL ON auth.users TO service_role;
GRANT ALL ON auth.identities TO service_role;
GRANT ALL ON user_profiles TO service_role;

-- Fix existing users with service_role permissions
SET ROLE service_role;
UPDATE auth.users
SET 
  aud = 'authenticated',
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, now()),
  last_sign_in_at = COALESCE(last_sign_in_at, now()),
  confirmation_sent_at = COALESCE(confirmation_sent_at, now()),
  providers = ARRAY['email'],
  raw_app_meta_data = jsonb_build_object(
    'provider', 'email',
    'providers', ARRAY['email'],
    'role', COALESCE(raw_app_meta_data->>'role', 'user')
  ),
  raw_user_meta_data = jsonb_build_object(
    'email_verified', true,
    'role', COALESCE(raw_user_meta_data->>'role', 'user')
  )
WHERE aud IS NULL 
   OR created_at IS NULL 
   OR updated_at IS NULL 
   OR last_sign_in_at IS NULL
   OR confirmation_sent_at IS NULL
   OR providers = '{}'::text[]
   OR raw_app_meta_data->>'provider' != 'email';
RESET ROLE; 