-- First, ensure we're in the right schema context
SET search_path = public, auth, pg_temp;

-- Drop existing functions to recreate them
DO $$ BEGIN
  DROP FUNCTION IF EXISTS auth.is_admin() CASCADE;
  DROP FUNCTION IF EXISTS debug_admin_access() CASCADE;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create robust admin check function in auth schema
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
DECLARE
  v_user_id uuid;
  v_user_role text;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  -- Exit early if no user ID
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check user role in profile
  SELECT role INTO v_user_role
  FROM user_profiles
  WHERE id = v_user_id;

  -- Return true if user has admin role
  RETURN COALESCE(v_user_role = 'admin', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create debug function in public schema
CREATE OR REPLACE FUNCTION debug_admin_access()
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_result jsonb;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  -- Exit early if no user ID
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'error', 'No authenticated user found',
      'is_admin', false
    );
  END IF;

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

-- Comment functions for PostgREST
COMMENT ON FUNCTION debug_admin_access() IS 'Get debug information about current user''s admin access';
COMMENT ON FUNCTION auth.is_admin() IS 'Check if current user is an admin';

-- Ensure proper permissions
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION debug_admin_access() TO authenticated;
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

-- Ensure user profiles exist for all users
INSERT INTO user_profiles (id, role)
SELECT 
  id,
  COALESCE(raw_app_meta_data->>'role', 'user')::text
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM user_profiles p WHERE p.id = u.id
); 