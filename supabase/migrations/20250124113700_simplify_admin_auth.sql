-- First, clean up existing functions and policies
DO $$ BEGIN
  -- Drop existing functions
  DROP FUNCTION IF EXISTS auth.is_admin() CASCADE;
  DROP FUNCTION IF EXISTS public.debug_admin_access() CASCADE;
  DROP FUNCTION IF EXISTS auth.has_merchant_access() CASCADE;
  
  -- Drop existing policies
  DROP POLICY IF EXISTS "users_read_own_profile" ON user_profiles;
  DROP POLICY IF EXISTS "admin_manage_profiles" ON user_profiles;
  DROP POLICY IF EXISTS "users_read_profile" ON user_profiles;
  DROP POLICY IF EXISTS "admin_manage_all" ON user_profiles;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create simple admin check function
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM user_profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create simple RLS policies for user_profiles
CREATE POLICY "admin_full_access"
  ON user_profiles
  FOR ALL
  TO authenticated
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin());

CREATE POLICY "users_view_own"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Ensure RLS is enabled
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated;
GRANT ALL ON user_profiles TO authenticated;

-- Create function to promote user to admin (only callable by existing admins)
CREATE OR REPLACE FUNCTION promote_to_admin(user_id uuid)
RETURNS void AS $$
BEGIN
  -- Verify caller is admin
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admins can promote users to admin';
  END IF;

  -- Update or create user profile
  INSERT INTO user_profiles (id, role)
  VALUES (user_id, 'admin')
  ON CONFLICT (id) DO UPDATE 
  SET role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to revoke admin access (only callable by existing admins)
CREATE OR REPLACE FUNCTION revoke_admin(user_id uuid)
RETURNS void AS $$
BEGIN
  -- Verify caller is admin
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admins can revoke admin access';
  END IF;

  -- Prevent revoking your own admin access
  IF user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot revoke your own admin access';
  END IF;

  -- Update user profile
  UPDATE user_profiles
  SET role = 'user'
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on admin management functions
GRANT EXECUTE ON FUNCTION promote_to_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_admin(uuid) TO authenticated;

-- Ensure initial admin exists (if not already set)
INSERT INTO user_profiles (id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'admin420@merchant.local'
  AND NOT EXISTS (
    SELECT 1 FROM user_profiles WHERE role = 'admin'
  )
ON CONFLICT (id) DO UPDATE SET role = 'admin'; 