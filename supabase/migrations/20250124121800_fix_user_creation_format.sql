-- Drop existing function and trigger
DROP FUNCTION IF EXISTS create_user_with_username(text, text, user_role);
DROP TRIGGER IF EXISTS ensure_user_fields ON auth.users;
DROP FUNCTION IF EXISTS fix_user_fields();

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
    'authenticated',                          -- aud explicitly set to 'authenticated'
    'authenticated',                          -- role
    v_email,                                 -- email
    crypt(p_password, gen_salt('bf', 6)),    -- encrypted_password with cost 6
    v_confirmed_at,                          -- email_confirmed_at
    null,                                    -- invited_at
    '',                                      -- confirmation_token
    null,                                    -- confirmation_sent_at
    '',                                      -- recovery_token
    null,                                    -- recovery_sent_at
    '',                                      -- email_change_token_new
    '',                                      -- email_change
    null,                                    -- email_change_sent_at
    v_now,                                   -- last_sign_in_at set to now()
    jsonb_build_object(                      -- raw_app_meta_data
      'provider', 'email',                   -- provider set to 'email'
      'providers', ARRAY['email'],           -- providers array set to ['email']
      'role', p_role::text                   -- include role in metadata
    ),
    jsonb_build_object(                      -- raw_user_meta_data
      'email_verified', true
    ),
    null,                                    -- is_super_admin
    v_now,                                   -- created_at explicitly set to now()
    v_now,                                   -- updated_at explicitly set to now()
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
    ARRAY['email']                          -- providers array set to ['email']
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
    AND aud = 'authenticated'                            -- Verify aud is 'authenticated'
    AND created_at IS NOT NULL                          -- Verify created_at is set
    AND updated_at IS NOT NULL                          -- Verify updated_at is set
    AND providers @> ARRAY['email']                     -- Verify providers contains 'email'
    AND raw_app_meta_data->>'provider' = 'email'        -- Verify provider is 'email'
    AND raw_app_meta_data->'providers' @> '"email"'     -- Verify providers in metadata contains 'email'
  ) THEN
    -- Log the actual values for debugging
    RAISE NOTICE 'User creation verification failed for user %:', v_user_id;
    RAISE NOTICE 'aud: %, created_at: %, updated_at: %, providers: %, raw_app_meta_data: %',
      (SELECT aud FROM auth.users WHERE id = v_user_id),
      (SELECT created_at FROM auth.users WHERE id = v_user_id),
      (SELECT updated_at FROM auth.users WHERE id = v_user_id),
      (SELECT providers FROM auth.users WHERE id = v_user_id),
      (SELECT raw_app_meta_data FROM auth.users WHERE id = v_user_id);
    
    RAISE EXCEPTION 'User creation verification failed: Critical fields not set correctly';
  END IF;

  -- Ensure fields are set correctly one last time
  UPDATE auth.users
  SET 
    aud = 'authenticated',
    created_at = COALESCE(created_at, v_now),
    updated_at = COALESCE(updated_at, v_now),
    providers = ARRAY['email'],
    raw_app_meta_data = jsonb_build_object(
      'provider', 'email',
      'providers', ARRAY['email'],
      'role', p_role::text
    ),
    raw_user_meta_data = jsonb_build_object(
      'email_verified', true
    )
  WHERE id = v_user_id;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth;

-- Create a trigger function to ensure fields are always set correctly
CREATE OR REPLACE FUNCTION fix_user_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Always set these fields
  NEW.aud := 'authenticated';
  NEW.created_at := COALESCE(NEW.created_at, now());
  NEW.updated_at := COALESCE(NEW.updated_at, now());
  NEW.providers := ARRAY['email'];
  
  -- Fix metadata if needed
  IF NEW.raw_app_meta_data IS NULL OR NEW.raw_app_meta_data->>'provider' != 'email' THEN
    NEW.raw_app_meta_data := jsonb_build_object(
      'provider', 'email',
      'providers', ARRAY['email'],
      'role', COALESCE(NEW.raw_app_meta_data->>'role', 'user')
    );
  END IF;

  -- Fix user metadata if needed
  IF NEW.raw_user_meta_data IS NULL OR NEW.raw_user_meta_data->>'email_verified' IS NULL THEN
    NEW.raw_user_meta_data := jsonb_build_object(
      'email_verified', true
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER ensure_user_fields
  BEFORE INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION fix_user_fields();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION create_user_with_username(text, text, user_role) TO authenticated; 