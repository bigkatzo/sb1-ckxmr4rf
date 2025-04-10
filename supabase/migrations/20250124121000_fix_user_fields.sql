-- Drop existing function
DROP FUNCTION IF EXISTS create_user_with_username(text, text, user_role);

-- Create function with complete user field setup
CREATE OR REPLACE FUNCTION create_user_with_username(
  p_username text,
  p_password text,
  p_role user_role DEFAULT 'user'
)
RETURNS uuid AS $$
DECLARE
  v_user_id uuid;
  v_email text;
  v_now timestamptz;
BEGIN
  -- Check admin authorization using RBAC
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can create users';
  END IF;

  -- Validate username
  PERFORM validate_username(p_username);
  
  -- Set current timestamp
  v_now := now();
  
  -- Create email
  v_email := p_username || '@merchant.local';

  -- Create user with all required fields
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
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
    is_anonymous
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',  -- instance_id
    gen_random_uuid(),                        -- id
    'authenticated',                          -- aud
    'authenticated',                          -- role
    v_email,                                 -- email
    crypt(p_password, gen_salt('bf', 10)),   -- encrypted_password
    v_now,                                   -- email_confirmed_at
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
    false                                    -- is_anonymous
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
      'provider', 'email'
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

  -- Verify user was created
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Failed to create user';
  END IF;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION create_user_with_username(text, text, user_role) TO authenticated;

-- Add function to fix existing users
CREATE OR REPLACE FUNCTION fix_user_auth(p_email text)
RETURNS void AS $$
DECLARE
  v_user_id uuid;
  v_now timestamptz;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  v_now := now();

  -- Fix auth.users record
  UPDATE auth.users
  SET
    aud = 'authenticated',
    last_sign_in_at = COALESCE(last_sign_in_at, v_now),
    created_at = COALESCE(created_at, v_now),
    updated_at = COALESCE(updated_at, v_now),
    raw_app_meta_data = jsonb_build_object(
      'provider', 'email',
      'providers', ARRAY['email'],
      'role', (SELECT role FROM user_profiles WHERE id = v_user_id)
    ),
    raw_user_meta_data = jsonb_build_object(
      'role', (SELECT role FROM user_profiles WHERE id = v_user_id)
    )
  WHERE id = v_user_id;

  -- Ensure auth identity exists
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
      'email', p_email,
      'provider', 'email'
    ),
    'email',
    v_now,
    v_now,
    v_now
  )
  ON CONFLICT (id) DO UPDATE
  SET
    identity_data = jsonb_build_object(
      'sub', v_user_id::text,
      'email', p_email,
      'provider', 'email'
    ),
    provider = 'email',
    last_sign_in_at = v_now,
    updated_at = v_now;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 