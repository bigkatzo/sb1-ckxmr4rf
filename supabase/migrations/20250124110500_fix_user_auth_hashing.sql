-- Drop and recreate the user creation function with proper password hashing
CREATE OR REPLACE FUNCTION create_user_with_username(
  p_username text,
  p_password text,
  p_role text DEFAULT 'user'
)
RETURNS uuid AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Verify caller is admin
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin can create users';
  END IF;

  -- Validate username
  IF NOT (p_username ~ '^[a-zA-Z0-9_-]{3,20}$') THEN
    RAISE EXCEPTION 'Invalid username. Use 3-20 characters, letters, numbers, underscore or hyphen only.';
  END IF;

  -- Validate role
  IF p_role NOT IN ('admin', 'merchant', 'user') THEN
    RAISE EXCEPTION 'Invalid role. Must be admin, merchant, or user';
  END IF;

  -- Check if username exists
  IF EXISTS (
    SELECT 1 FROM auth.users 
    WHERE email = p_username || '@merchant.local'
  ) THEN
    RAISE EXCEPTION 'Username already taken';
  END IF;

  -- Create user in auth.users with proper password hashing
  v_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmed_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    role,
    aud,
    created_at,
    updated_at
  )
  VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    p_username || '@merchant.local',
    crypt(p_password, gen_salt('bf')),
    now(),
    now(),
    NULL,
    jsonb_build_object(
      'provider', 'email',
      'providers', array['email'],
      'username', p_username,
      'role', p_role
    ),
    jsonb_build_object(
      'username', p_username,
      'role', p_role
    ),
    'authenticated',
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

-- Fix existing user if it exists
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get the user ID
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'supauser@merchant.local';

  IF v_user_id IS NOT NULL THEN
    -- Update the user's auth settings
    UPDATE auth.users
    SET 
      email_confirmed_at = now(),
      confirmed_at = now(),
      last_sign_in_at = NULL,
      raw_app_meta_data = jsonb_build_object(
        'provider', 'email',
        'providers', array['email'],
        'username', 'supauser',
        'role', 'merchant'
      ),
      raw_user_meta_data = jsonb_build_object(
        'username', 'supauser',
        'role', 'merchant'
      ),
      role = 'authenticated',
      aud = 'authenticated',
      updated_at = now()
    WHERE id = v_user_id;

    -- Ensure user profile exists
    INSERT INTO user_profiles (id, role)
    VALUES (v_user_id, 'merchant')
    ON CONFLICT (id) DO UPDATE
    SET role = 'merchant';
  END IF;
END $$; 