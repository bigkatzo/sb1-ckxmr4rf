-- Remove all users with @merchant.local emails
DELETE FROM auth.users 
WHERE email LIKE '%@merchant.local';

-- Drop all custom auth functions
DO $$ BEGIN
  DROP FUNCTION IF EXISTS auth.is_admin() CASCADE;
  DROP FUNCTION IF EXISTS auth.has_merchant_access() CASCADE;
  DROP FUNCTION IF EXISTS auth.get_role() CASCADE;
  DROP FUNCTION IF EXISTS auth.is_merchant() CASCADE;
  DROP FUNCTION IF EXISTS create_user_with_username(text, text, text) CASCADE;
  DROP FUNCTION IF EXISTS create_user_with_role(text, text, text) CASCADE;
  DROP FUNCTION IF EXISTS create_merchant_user(text, text, text) CASCADE;
  DROP FUNCTION IF EXISTS create_exact_copy_user(text, text, text) CASCADE;
  DROP FUNCTION IF EXISTS create_auth_user(text, text, text) CASCADE;
  DROP FUNCTION IF EXISTS reset_user_password(text, text) CASCADE;
  DROP FUNCTION IF EXISTS verify_merchant_access(uuid) CASCADE;
  DROP FUNCTION IF EXISTS handle_auth_user() CASCADE;
  DROP FUNCTION IF EXISTS sync_user_profile() CASCADE;
  DROP FUNCTION IF EXISTS ensure_user_profile() CASCADE;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Drop all custom triggers
DROP TRIGGER IF EXISTS handle_auth_user_trigger ON auth.users;
DROP TRIGGER IF EXISTS sync_user_profile_trigger ON auth.users;
DROP TRIGGER IF EXISTS ensure_user_profile_trigger ON auth.users;

-- Create simple admin check function that uses user_profiles
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

-- Create simple merchant check function that uses user_profiles
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

-- Ensure RLS is enabled
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "users_read_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "admin_manage_profiles" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_policy" ON user_profiles;
DROP POLICY IF EXISTS "read_own_profile" ON user_profiles;

-- Create simple RLS policies
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

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated, anon;
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION auth.has_merchant_access() TO authenticated, anon;
GRANT ALL ON user_profiles TO authenticated; 