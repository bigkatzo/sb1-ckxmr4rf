-- Drop existing functions
DROP FUNCTION IF EXISTS auth.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;

-- Create admin check function in public schema for PostgREST access
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  -- Check if user has admin role in profile
  RETURN EXISTS (
    SELECT 1 
    FROM user_profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;

-- Ensure RLS is enabled
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Update RLS policies to use public.is_admin()
DROP POLICY IF EXISTS "admin_full_access" ON user_profiles;
DROP POLICY IF EXISTS "users_view_own" ON user_profiles;

CREATE POLICY "admin_full_access"
  ON user_profiles
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "users_view_own"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Ensure initial admin exists
INSERT INTO user_profiles (id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'admin420@merchant.local'
ON CONFLICT (id) DO UPDATE SET role = 'admin'; 