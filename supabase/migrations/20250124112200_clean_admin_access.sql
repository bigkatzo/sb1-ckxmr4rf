-- First, drop ALL existing policies and functions that might interfere
DO $$ 
BEGIN
  -- Drop all policies from relevant tables
  DROP POLICY IF EXISTS "users_read_own_profile" ON user_profiles;
  DROP POLICY IF EXISTS "admin_manage_profiles" ON user_profiles;
  DROP POLICY IF EXISTS "read_own_profile" ON user_profiles;
  DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
  DROP POLICY IF EXISTS "user_profiles_policy" ON user_profiles;
  DROP POLICY IF EXISTS "users can view own profile" ON user_profiles;
  
  -- Drop all auth functions
  DROP FUNCTION IF EXISTS auth.is_admin() CASCADE;
  DROP FUNCTION IF EXISTS auth.has_merchant_access() CASCADE;
  DROP FUNCTION IF EXISTS auth.get_role() CASCADE;
  DROP FUNCTION IF EXISTS admin_list_users() CASCADE;
  DROP FUNCTION IF EXISTS list_users() CASCADE;
  DROP FUNCTION IF EXISTS manage_user_role(uuid, text) CASCADE;
  DROP FUNCTION IF EXISTS ensure_user_profile() CASCADE;
  DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Recreate the core auth functions
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

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO user_profiles (id, role)
  VALUES (
    NEW.id,
    COALESCE(
      (NEW.raw_app_meta_data->>'role')::user_role,
      'user'::user_role
    )
  )
  ON CONFLICT (id) DO UPDATE
  SET role = EXCLUDED.role;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for user management
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.raw_app_meta_data->>'role' IS DISTINCT FROM NEW.raw_app_meta_data->>'role')
  EXECUTE FUNCTION handle_new_user();

-- Enable RLS on user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create clean RLS policies
CREATE POLICY "user_profiles_select_policy"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() 
    OR (SELECT auth.is_admin())
  );

CREATE POLICY "user_profiles_all_admin_policy"
  ON user_profiles
  FOR ALL
  TO authenticated
  USING (
    (SELECT auth.is_admin())
  )
  WITH CHECK (
    (SELECT auth.is_admin())
  );

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.has_merchant_access() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_list_users() TO authenticated;
GRANT ALL ON user_profiles TO authenticated;

-- Sync existing users to ensure they have profiles
INSERT INTO user_profiles (id, role)
SELECT 
  id,
  COALESCE(
    (raw_app_meta_data->>'role')::user_role,
    'user'::user_role
  ) as role
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET role = EXCLUDED.role; 