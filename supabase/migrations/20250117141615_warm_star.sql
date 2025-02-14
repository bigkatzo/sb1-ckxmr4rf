-- Drop existing functions to recreate
DROP FUNCTION IF EXISTS create_user_with_username CASCADE;
DROP FUNCTION IF EXISTS reset_user_password CASCADE;

-- Create function to properly hash password
CREATE OR REPLACE FUNCTION hash_password(password text)
RETURNS text AS $$
BEGIN
  RETURN crypt(password, gen_salt('bf', 10));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to verify password
CREATE OR REPLACE FUNCTION verify_password(password text, hashed_password text)
RETURNS boolean AS $$
BEGIN
  RETURN hashed_password = crypt(password, hashed_password);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to create user with role
CREATE OR REPLACE FUNCTION create_user_with_username(
  p_username text,
  p_password text,
  p_role text DEFAULT 'user'
)
RETURNS uuid AS $$
DECLARE
  v_user_id uuid;
  v_email text;
BEGIN
  -- Verify caller is admin
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin can create users';
  END IF;

  -- Generate new UUID
  v_user_id := gen_random_uuid();
  
  -- Validate username
  IF NOT (p_username ~ '^[a-zA-Z0-9_-]{3,20}$') THEN
    RAISE EXCEPTION 'Invalid username. Use 3-20 characters, letters, numbers, underscore or hyphen only.';
  END IF;

  -- Set email
  v_email := p_username || '@merchant.local';

  -- Check if username exists
  IF EXISTS (
    SELECT 1 FROM auth.users 
    WHERE email = v_email
  ) THEN
    RAISE EXCEPTION 'Username already taken';
  END IF;

  -- Create user in auth.users
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    role,
    created_at,
    updated_at
  )
  VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    v_email,
    hash_password(p_password),
    now(),
    jsonb_build_object(
      'provider', 'username',
      'providers', array['username'],
      'username', p_username
    ),
    jsonb_build_object(
      'username', p_username
    ),
    'authenticated',
    now(),
    now()
  );

  -- Create user profile with role
  INSERT INTO user_profiles (id, role)
  VALUES (v_user_id, p_role);

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate user420 with proper password hashing
DO $$ 
DECLARE
  v_user_id uuid;
BEGIN
  -- Generate new UUID for user420
  v_user_id := gen_random_uuid();

  -- Delete existing user420 if exists
  DELETE FROM auth.users 
  WHERE email = 'user420@merchant.local';

  -- Create user420 with proper password
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    role,
    created_at,
    updated_at
  )
  VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'user420@merchant.local',
    hash_password('St0pClickin!123'),
    now(),
    jsonb_build_object(
      'provider', 'username',
      'providers', array['username'],
      'username', 'user420'
    ),
    jsonb_build_object(
      'username', 'user420'
    ),
    'authenticated',
    now(),
    now()
  );

  -- Create merchant profile
  INSERT INTO user_profiles (id, role)
  VALUES (v_user_id, 'merchant')
  ON CONFLICT (id) DO UPDATE 
  SET role = 'merchant';
END $$;

-- Verify user420 setup
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.users u
    JOIN user_profiles p ON p.id = u.id
    WHERE u.email = 'user420@merchant.local'
    AND p.role = 'merchant'
    AND u.email_confirmed_at IS NOT NULL
    AND verify_password('St0pClickin!123', u.encrypted_password)
  ) THEN
    RAISE EXCEPTION 'User420 setup verification failed';
  END IF;
END $$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION hash_password(text) TO authenticated;
GRANT EXECUTE ON FUNCTION verify_password(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_with_username(text, text, text) TO authenticated;