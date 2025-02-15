-- Drop all existing policies first
DO $$ BEGIN
  DROP POLICY IF EXISTS "users_read_own_profile" ON user_profiles;
  DROP POLICY IF EXISTS "admin_manage_profiles" ON user_profiles;
  DROP POLICY IF EXISTS "user_profiles_policy" ON user_profiles;
  DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Recreate auth.is_admin() function
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

-- Enable RLS on user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create simplified RLS policies
CREATE POLICY "read_own_profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() 
    OR auth.is_admin()
  );

CREATE POLICY "admin_manage_profiles"
  ON user_profiles
  FOR ALL
  TO authenticated
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin());

-- Ensure supauser has correct settings
UPDATE auth.users
SET 
  email_confirmed_at = now(),
  confirmed_at = now(),
  last_sign_in_at = NULL,
  raw_app_meta_data = jsonb_build_object(
    'provider', 'username',
    'providers', array['username'],
    'username', 'supauser',
    'role', 'merchant'
  ),
  raw_user_meta_data = jsonb_build_object(
    'username', 'supauser',
    'role', 'merchant'
  ),
  role = 'authenticated'
WHERE email = 'supauser@merchant.local';

-- Ensure user profile exists with correct role
INSERT INTO user_profiles (id, role)
SELECT id, 'merchant'
FROM auth.users
WHERE email = 'supauser@merchant.local'
ON CONFLICT (id) DO UPDATE
SET role = 'merchant';

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.has_merchant_access() TO authenticated;
GRANT ALL ON user_profiles TO authenticated; 