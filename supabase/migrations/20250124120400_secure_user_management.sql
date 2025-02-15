-- Create an enum for user roles if it doesn't exist
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'merchant', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create a function to check if a user is an admin using RBAC
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  -- Check if the user has the admin role in user_profiles
  RETURN EXISTS (
    SELECT 1 
    FROM user_profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'::user_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to validate username
CREATE OR REPLACE FUNCTION validate_username(p_username text)
RETURNS boolean AS $$
BEGIN
  -- Check for valid characters (alphanumeric and underscore only)
  IF NOT p_username ~ '^[a-zA-Z0-9_]+$' THEN
    RAISE EXCEPTION 'Username can only contain letters, numbers, and underscores';
  END IF;

  -- Check length
  IF length(p_username) < 3 OR length(p_username) > 50 THEN
    RAISE EXCEPTION 'Username must be between 3 and 50 characters';
  END IF;

  -- Check uniqueness
  IF EXISTS (
    SELECT 1 
    FROM auth.users 
    WHERE email = p_username || '@merchant.local'
  ) THEN
    RAISE EXCEPTION 'Username already taken';
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a secure function to create users
CREATE OR REPLACE FUNCTION create_user_with_username(
  p_username text,
  p_password text,
  p_role user_role DEFAULT 'user'
)
RETURNS uuid AS $$
DECLARE
  v_user_id uuid;
  v_email text;
BEGIN
  -- Check admin authorization using RBAC
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can create users';
  END IF;

  -- Validate username
  PERFORM validate_username(p_username);
  
  -- Create email
  v_email := p_username || '@merchant.local';

  -- Use Supabase's auth.create_user to properly handle user creation
  SELECT id INTO v_user_id
  FROM auth.create_user(
    jsonb_build_object(
      'email', v_email,
      'password', p_password,
      'email_confirm', true,
      'user_metadata', jsonb_build_object(
        'role', p_role
      )
    )
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
    now(),
    now()
  );

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth;

-- Create RLS policies for user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "users_read_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "admins_manage_profiles" ON user_profiles;

-- Create secure policies
CREATE POLICY "users_read_own_profile" ON user_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "admins_manage_profiles" ON user_profiles
  FOR ALL
  TO authenticated
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin());

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION validate_username(text) TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_with_username(text, text, user_role) TO authenticated;

-- Revoke direct table access
REVOKE ALL ON auth.users FROM authenticated;
REVOKE ALL ON auth.identities FROM authenticated;

-- Create or update admin420 with proper role
DO $$ 
DECLARE
  v_admin_id uuid;
BEGIN
  -- Get admin420's ID if exists
  SELECT id INTO v_admin_id
  FROM auth.users
  WHERE email = 'admin420@merchant.local';

  -- Update or insert admin profile
  IF v_admin_id IS NOT NULL THEN
    INSERT INTO user_profiles (id, role, created_at, updated_at)
    VALUES (v_admin_id, 'admin', now(), now())
    ON CONFLICT (id) DO UPDATE 
    SET role = 'admin',
        updated_at = now();
  END IF;
END $$; 