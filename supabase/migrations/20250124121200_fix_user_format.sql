-- Drop existing function
DROP FUNCTION IF EXISTS create_user_with_username(text, text, user_role);

-- Create function that matches working user format exactly
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
  v_confirmed_at timestamptz;
BEGIN
  -- Check admin authorization using RBAC
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can create users';
  END IF;

  -- Validate username
  PERFORM validate_username(p_username);
  
  -- Set timestamps
  v_now := now();
  v_confirmed_at := v_now;
  
  -- Create email
  v_email := p_username || '@merchant.local';

  -- Create user with exact matching fields
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
    null,                                     -- aud
    'authenticated',                          -- role
    v_email,                                 -- email
    crypt(p_password, gen_salt('bf', 6)),    -- encrypted_password with cost 6
    v_confirmed_at,                          -- email_confirmed_at
    null,                                    -- invited_at
    null,                                    -- confirmation_token
    null,                                    -- confirmation_sent_at
    null,                                    -- recovery_token
    null,                                    -- recovery_sent_at
    null,                                    -- email_change_token_new
    null,                                    -- email_change
    null,                                    -- email_change_sent_at
    null,                                    -- last_sign_in_at
    jsonb_build_object(                      -- raw_app_meta_data
      'provider', 'username',
      'username', p_username,
      'providers', ARRAY['username']
    ),
    jsonb_build_object(                      -- raw_user_meta_data
      'username', p_username
    ),
    null,                                    -- is_super_admin
    null,                                    -- created_at
    null,                                    -- updated_at
    null,                                    -- phone
    null,                                    -- phone_confirmed_at
    '',                                      -- phone_change
    '',                                      -- phone_change_token
    null,                                    -- phone_change_sent_at
    v_confirmed_at,                          -- confirmed_at
    '',                                      -- email_change_token_current
    0,                                       -- email_change_confirm_status
    null,                                    -- banned_until
    '',                                      -- reauthentication_token
    null,                                    -- reauthentication_sent_at
    false,                                   -- is_sso_user
    null,                                    -- deleted_at
    false,                                   -- is_anonymous
    p_username,                              -- username
    ARRAY[]::text[]                         -- providers (empty array)
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
      'username', p_username
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