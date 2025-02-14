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
  DROP POLICY IF EXISTS "view_own_profile" ON user_profiles;
  DROP POLICY IF EXISTS "admin_manage_profiles" ON user_profiles;
  DROP POLICY IF EXISTS "user_profiles_select" ON user_profiles;
  DROP POLICY IF EXISTS "user_profiles_all" ON user_profiles;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create maximally permissive policies for admin
CREATE POLICY "user_profiles_admin_all"
  ON user_profiles FOR ALL
  TO authenticated
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin());

-- Create public read policy for profiles
CREATE POLICY "user_profiles_public_select"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (true);

-- Grant all necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated;
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