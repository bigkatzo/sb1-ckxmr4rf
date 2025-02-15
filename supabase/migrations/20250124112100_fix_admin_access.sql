-- Drop any existing policies that might interfere
DROP POLICY IF EXISTS "users_read_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "admin_manage_profiles" ON user_profiles;
DROP POLICY IF EXISTS "read_own_profile" ON user_profiles;

-- Create clean RLS policies for user_profiles
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

-- Ensure RLS is enabled
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create function to check admin access
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check merchant access
CREATE OR REPLACE FUNCTION auth.has_merchant_access()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'merchant')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.has_merchant_access() TO authenticated;
GRANT ALL ON user_profiles TO authenticated;

-- Create admin management functions
CREATE OR REPLACE FUNCTION admin_list_users()
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
  ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute on admin functions
GRANT EXECUTE ON FUNCTION admin_list_users() TO authenticated; 