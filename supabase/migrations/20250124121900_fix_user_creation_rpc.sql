-- Drop all existing functions and triggers to start fresh
DROP FUNCTION IF EXISTS create_user_with_username(text, text, user_role);
DROP TRIGGER IF EXISTS ensure_user_fields ON auth.users;
DROP FUNCTION IF EXISTS fix_user_fields();

-- Create the user creation function
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
  -- Check admin authorization
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can create users';
  END IF;

  -- Set current timestamp
  v_now := now();
  
  -- Create email
  v_email := p_username || '@merchant.local';

  -- First, create the user directly in auth.users
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
    crypt(p_password, gen_salt('bf', 6)),
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

  -- Verify the user was created with correct fields
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
    -- Log the actual values for debugging
    RAISE LOG 'User creation verification failed for user %:', v_user_id;
    RAISE LOG 'Current values: aud=%, created_at=%, updated_at=%, providers=%, raw_app_meta_data=%',
      (SELECT aud FROM auth.users WHERE id = v_user_id),
      (SELECT created_at FROM auth.users WHERE id = v_user_id),
      (SELECT updated_at FROM auth.users WHERE id = v_user_id),
      (SELECT providers FROM auth.users WHERE id = v_user_id),
      (SELECT raw_app_meta_data FROM auth.users WHERE id = v_user_id);
    
    -- Try to fix the user
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
    
    -- Verify again after fix
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
      RAISE EXCEPTION 'Failed to create user with correct fields';
    END IF;
  END IF;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- Add a function to fix existing users
CREATE OR REPLACE FUNCTION fix_existing_users()
RETURNS void AS $$
BEGIN
  UPDATE auth.users
  SET 
    aud = 'authenticated',
    created_at = COALESCE(created_at, now()),
    updated_at = COALESCE(updated_at, now()),
    providers = ARRAY['email'],
    raw_app_meta_data = jsonb_build_object(
      'provider', 'email',
      'providers', ARRAY['email'],
      'role', COALESCE(raw_app_meta_data->>'role', 'user')
    ),
    raw_user_meta_data = jsonb_build_object(
      'email_verified', true
    )
  WHERE aud IS NULL 
     OR created_at IS NULL 
     OR updated_at IS NULL 
     OR providers = '{}'::text[] 
     OR raw_app_meta_data->>'provider' != 'email';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run fix on existing users
SELECT fix_existing_users(); 