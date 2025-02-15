-- Drop existing functions to recreate them
DO $$ BEGIN
  DROP FUNCTION IF EXISTS auth.is_admin() CASCADE;
  DROP FUNCTION IF EXISTS debug_admin_access() CASCADE;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create robust admin check function that works for any admin user
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  -- Exit early if no user ID
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check if user has admin role in profile
  RETURN EXISTS (
    SELECT 1 
    FROM user_profiles 
    WHERE id = v_user_id 
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create debug function with better error handling
CREATE OR REPLACE FUNCTION debug_admin_access()
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_result jsonb;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  -- Build debug info
  SELECT jsonb_build_object(
    'user_id', v_user_id,
    'email', u.email,
    'auth_role', u.role,
    'metadata_role', u.raw_app_meta_data->>'role',
    'profile_exists', EXISTS (SELECT 1 FROM user_profiles WHERE id = v_user_id),
    'profile_role', p.role,
    'is_admin', auth.is_admin()
  )
  INTO v_result
  FROM auth.users u
  LEFT JOIN user_profiles p ON p.id = u.id
  WHERE u.id = v_user_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to promote user to admin
CREATE OR REPLACE FUNCTION promote_to_admin(p_user_id uuid)
RETURNS void AS $$
BEGIN
  -- Verify caller is admin
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admins can promote users to admin';
  END IF;

  -- Update or create user profile with admin role
  INSERT INTO user_profiles (id, role)
  VALUES (p_user_id, 'admin')
  ON CONFLICT (id) DO UPDATE 
  SET role = 'admin';

  -- Update user metadata
  UPDATE auth.users
  SET 
    raw_app_meta_data = jsonb_build_object(
      'role', 'admin'
    ),
    raw_user_meta_data = jsonb_build_object(
      'role', 'admin'
    )
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to revoke admin access
CREATE OR REPLACE FUNCTION revoke_admin(p_user_id uuid)
RETURNS void AS $$
BEGIN
  -- Verify caller is admin
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admins can revoke admin access';
  END IF;

  -- Prevent revoking your own admin access
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot revoke your own admin access';
  END IF;

  -- Update user profile to regular user
  UPDATE user_profiles
  SET role = 'user'
  WHERE id = p_user_id;

  -- Update user metadata
  UPDATE auth.users
  SET 
    raw_app_meta_data = jsonb_build_object(
      'role', 'user'
    ),
    raw_user_meta_data = jsonb_build_object(
      'role', 'user'
    )
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION debug_admin_access() TO authenticated;
GRANT EXECUTE ON FUNCTION promote_to_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_admin(uuid) TO authenticated;
GRANT ALL ON user_profiles TO authenticated;

-- Ensure RLS is enabled
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Update RLS policies
DROP POLICY IF EXISTS "users_read_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "admin_manage_profiles" ON user_profiles;

CREATE POLICY "users_read_own_profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR auth.is_admin());

CREATE POLICY "admin_manage_profiles"
  ON user_profiles
  FOR ALL
  TO authenticated
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin()); 