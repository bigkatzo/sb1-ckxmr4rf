-- Drop existing admin function to avoid conflicts
DROP FUNCTION IF EXISTS auth.is_admin() CASCADE;

-- Create admin check function that uses both email and role
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND email = 'admin420@merchant.local'
    AND raw_app_meta_data->>'role' = 'supabase_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update admin420's metadata and role
UPDATE auth.users
SET 
  raw_app_meta_data = jsonb_build_object(
    'provider', 'username',
    'providers', array['username'],
    'role', 'supabase_admin',
    'is_admin', true
  ),
  raw_user_meta_data = jsonb_build_object(
    'role', 'supabase_admin',
    'is_admin', true
  ),
  role = 'service_role'
WHERE email = 'admin420@merchant.local';

-- Ensure admin420 has admin profile
INSERT INTO user_profiles (id, role)
SELECT id, 'admin'
FROM auth.users 
WHERE email = 'admin420@merchant.local'
ON CONFLICT (id) DO UPDATE 
SET role = 'admin';

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated;
GRANT ALL ON user_profiles TO authenticated;

-- Update RLS policies to use new admin check
DROP POLICY IF EXISTS "view_own_profile" ON user_profiles;
CREATE POLICY "view_own_profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() 
    OR auth.is_admin()
  );

DROP POLICY IF EXISTS "admin_manage_profiles" ON user_profiles;
CREATE POLICY "admin_manage_profiles"
  ON user_profiles FOR ALL
  TO authenticated
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin());