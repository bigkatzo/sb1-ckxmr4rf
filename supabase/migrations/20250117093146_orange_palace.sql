-- Drop existing admin function to recreate
DROP FUNCTION IF EXISTS auth.is_admin() CASCADE;

-- Create maximally simplified admin check function
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  -- Direct email check without any dependencies
  RETURN NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'email', '') = 'admin420@merchant.local';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop all role-related policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "user_profiles_admin_all" ON user_profiles;
  DROP POLICY IF EXISTS "user_profiles_public_select" ON user_profiles;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create maximally permissive policies for admin
CREATE POLICY "user_profiles_all"
  ON user_profiles FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (auth.is_admin());

-- Create function to list users with proper error handling
CREATE OR REPLACE FUNCTION list_users()
RETURNS TABLE (
  id uuid,
  email text,
  role text,
  created_at timestamptz
) AS $$
BEGIN
  -- Verify caller is admin
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin can list users';
  END IF;

  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    COALESCE(p.role, 'user') as role,
    u.created_at
  FROM auth.users u
  LEFT JOIN user_profiles p ON p.id = u.id
  WHERE u.email != 'admin420@merchant.local' -- Exclude admin from list
  ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to manage user roles with proper error handling
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

  -- Update or insert user profile
  INSERT INTO user_profiles (id, role)
  VALUES (p_user_id, p_role)
  ON CONFLICT (id) DO UPDATE 
  SET 
    role = EXCLUDED.role,
    updated_at = now();
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
BEGIN
  -- Verify caller is admin
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin can create users';
  END IF;

  -- Validate username
  IF NOT (p_username ~ '^[a-zA-Z0-9_-]{3,20}$') THEN
    RAISE EXCEPTION 'Invalid username. Use 3-20 characters, letters, numbers, underscore or hyphen only.';
  END IF;

  -- Check if username exists
  IF EXISTS (
    SELECT 1 FROM auth.users 
    WHERE email = p_username || '@merchant.local'
  ) THEN
    RAISE EXCEPTION 'Username already taken';
  END IF;

  -- Create user in auth.users
  v_user_id := gen_random_uuid();
  
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    role
  )
  VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    p_username || '@merchant.local',
    crypt(p_password, gen_salt('bf')),
    now(),
    jsonb_build_object(
      'provider', 'username',
      'providers', array['username'],
      'username', p_username
    ),
    jsonb_build_object(
      'username', p_username
    ),
    'authenticated'
  );

  -- Create user profile with role
  INSERT INTO user_profiles (id, role)
  VALUES (v_user_id, p_role);

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure admin420 has admin profile
DO $$ 
DECLARE
  v_admin_id uuid;
BEGIN
  -- Get admin420's user ID
  SELECT id INTO v_admin_id
  FROM auth.users
  WHERE email = 'admin420@merchant.local'
  LIMIT 1;

  IF v_admin_id IS NOT NULL THEN
    -- Create or update admin profile
    INSERT INTO user_profiles (id, role)
    VALUES (v_admin_id, 'admin')
    ON CONFLICT (id) DO UPDATE 
    SET role = 'admin';
  END IF;
END $$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION manage_user_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_with_username(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION list_users() TO authenticated;
GRANT ALL ON user_profiles TO authenticated;

-- Create function to check database connection
CREATE OR REPLACE FUNCTION check_database_connection()
RETURNS boolean AS $$
BEGIN
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on connection check
GRANT EXECUTE ON FUNCTION check_database_connection() TO authenticated;