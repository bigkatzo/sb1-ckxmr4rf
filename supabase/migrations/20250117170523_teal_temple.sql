-- First drop all triggers
DROP TRIGGER IF EXISTS ensure_user_profile_trigger ON auth.users;

-- Then drop all functions in correct order
DROP FUNCTION IF EXISTS list_users() CASCADE;
DROP FUNCTION IF EXISTS delete_user(uuid) CASCADE;
DROP FUNCTION IF EXISTS change_user_role(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS validate_user_credentials(text, text) CASCADE;
DROP FUNCTION IF EXISTS create_user_with_username(text, text, text) CASCADE;
DROP FUNCTION IF EXISTS ensure_user_profile() CASCADE;
DROP FUNCTION IF EXISTS verify_password(text, text) CASCADE;
DROP FUNCTION IF EXISTS hash_password(text) CASCADE;
DROP FUNCTION IF EXISTS validate_username(text) CASCADE;

-- Now recreate everything in correct order
-- Create function to validate username format
CREATE OR REPLACE FUNCTION validate_username(username text)
RETURNS boolean AS $$
BEGIN
  RETURN username ~ '^[a-zA-Z0-9_-]{3,20}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

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

-- Create function to ensure user profile exists
CREATE OR REPLACE FUNCTION ensure_user_profile()
RETURNS trigger AS $$
BEGIN
  -- Only create profile if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = NEW.id) THEN
    INSERT INTO user_profiles (id, role)
    VALUES (NEW.id, 'user');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic profile creation
CREATE TRIGGER ensure_user_profile_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION ensure_user_profile();

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

  -- Validate role
  IF p_role NOT IN ('admin', 'merchant', 'user') THEN
    RAISE EXCEPTION 'Invalid role. Must be admin, merchant, or user';
  END IF;

  -- Validate username
  IF NOT validate_username(p_username) THEN
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

  -- Start transaction
  BEGIN
    -- Temporarily disable trigger
    ALTER TABLE auth.users DISABLE TRIGGER ensure_user_profile_trigger;

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
      gen_random_uuid(),
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
    )
    RETURNING id INTO v_user_id;

    -- Create user profile with role
    INSERT INTO user_profiles (id, role)
    VALUES (v_user_id, p_role);

    -- Re-enable trigger
    ALTER TABLE auth.users ENABLE TRIGGER ensure_user_profile_trigger;

    RETURN v_user_id;
  EXCEPTION
    WHEN others THEN
      -- Clean up on error
      IF v_user_id IS NOT NULL THEN
        DELETE FROM auth.users WHERE id = v_user_id;
      END IF;
      -- Make sure to re-enable trigger even on error
      ALTER TABLE auth.users ENABLE TRIGGER ensure_user_profile_trigger;
      RAISE;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to validate user credentials
CREATE OR REPLACE FUNCTION validate_user_credentials(
  p_username text,
  p_password text
)
RETURNS TABLE (
  id uuid,
  email text,
  role text,
  has_collections boolean,
  has_access boolean
) AS $$
DECLARE
  v_user_id uuid;
  v_email text := p_username || '@merchant.local';
BEGIN
  -- Get user ID and verify password
  SELECT u.id INTO v_user_id
  FROM auth.users u
  WHERE u.email = v_email
  AND verify_password(p_password, u.encrypted_password);

  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    COALESCE(p.role, 'user') as role,
    EXISTS (
      SELECT 1 FROM collections c WHERE c.user_id = u.id
    ) as has_collections,
    EXISTS (
      SELECT 1 FROM collection_access ca WHERE ca.user_id = u.id
    ) as has_access
  FROM auth.users u
  LEFT JOIN user_profiles p ON p.id = u.id
  WHERE u.id = v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to change user role
CREATE OR REPLACE FUNCTION change_user_role(
  p_user_id uuid,
  p_new_role text
)
RETURNS void AS $$
BEGIN
  -- Verify caller is admin
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin can change user roles';
  END IF;

  -- Validate role
  IF p_new_role NOT IN ('admin', 'merchant', 'user') THEN
    RAISE EXCEPTION 'Invalid role. Must be admin, merchant, or user';
  END IF;

  -- Don't allow modifying admin420
  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = p_user_id
    AND email = 'admin420@merchant.local'
  ) THEN
    RAISE EXCEPTION 'Cannot modify admin user role';
  END IF;

  -- Update role
  UPDATE user_profiles
  SET 
    role = p_new_role,
    updated_at = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to list users with roles
CREATE OR REPLACE FUNCTION list_users()
RETURNS TABLE (
  id uuid,
  username text,
  email text,
  role text,
  created_at timestamptz,
  has_collections boolean,
  has_access boolean
) AS $$
BEGIN
  -- Verify caller is admin
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin can list users';
  END IF;

  RETURN QUERY
  SELECT 
    u.id,
    u.raw_user_meta_data->>'username' as username,
    u.email,
    COALESCE(p.role, 'user') as role,
    u.created_at,
    EXISTS (
      SELECT 1 FROM collections c WHERE c.user_id = u.id
    ) as has_collections,
    EXISTS (
      SELECT 1 FROM collection_access ca WHERE ca.user_id = u.id
    ) as has_access
  FROM auth.users u
  LEFT JOIN user_profiles p ON p.id = u.id
  WHERE u.email != 'admin420@merchant.local'
  ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to delete user
CREATE OR REPLACE FUNCTION delete_user(p_user_id uuid)
RETURNS void AS $$
BEGIN
  -- Verify caller is admin
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin can delete users';
  END IF;

  -- Don't allow deleting admin420
  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = p_user_id
    AND email = 'admin420@merchant.local'
  ) THEN
    RAISE EXCEPTION 'Cannot delete admin user';
  END IF;

  -- Delete user (will cascade to profile)
  DELETE FROM auth.users
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION validate_username(text) TO authenticated;
GRANT EXECUTE ON FUNCTION hash_password(text) TO authenticated;
GRANT EXECUTE ON FUNCTION verify_password(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_with_username(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_user_credentials(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION change_user_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION delete_user(uuid) TO authenticated;
GRANT ALL ON user_profiles TO authenticated;

-- Recreate user420 with proper setup
DO $$ 
DECLARE
  v_user_id uuid;
BEGIN
  -- Delete existing user420 if exists
  DELETE FROM auth.users 
  WHERE email = 'user420@merchant.local';

  -- Temporarily disable trigger
  ALTER TABLE auth.users DISABLE TRIGGER ensure_user_profile_trigger;

  -- Create new user420
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
    gen_random_uuid(),
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
  )
  RETURNING id INTO v_user_id;

  -- Create merchant profile
  INSERT INTO user_profiles (id, role)
  VALUES (v_user_id, 'merchant');

  -- Re-enable trigger
  ALTER TABLE auth.users ENABLE TRIGGER ensure_user_profile_trigger;

  -- Verify setup
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

-- Create function to manage user roles
CREATE OR REPLACE FUNCTION manage_user_role(
  p_user_id uuid,
  p_role text
)
RETURNS void AS $$
BEGIN
  -- Verify caller is admin
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin can manage user roles';
  END IF;

  -- Validate role
  IF p_role NOT IN ('admin', 'merchant', 'user') THEN
    RAISE EXCEPTION 'Invalid role. Must be admin, merchant, or user';
  END IF;

  -- Don't allow modifying admin420's role
  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = p_user_id
    AND email = 'admin420@merchant.local'
  ) THEN
    RAISE EXCEPTION 'Cannot modify admin user role';
  END IF;

  -- Update role with proper casting
  UPDATE user_profiles
  SET 
    role = p_role::user_role,
    updated_at = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;