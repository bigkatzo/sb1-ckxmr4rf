-- Drop existing admin function to recreate
DROP FUNCTION IF EXISTS auth.is_admin() CASCADE;

-- Create simplified admin check function that doesn't rely on user_profiles
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  -- Use direct email check without any table lookups
  RETURN NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'email', '') = 'admin420@merchant.local';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "view_own_profile" ON user_profiles;
  DROP POLICY IF EXISTS "admin_manage_profiles" ON user_profiles;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create simplified RLS policies for user_profiles
CREATE POLICY "user_profiles_select"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "user_profiles_all"
  ON user_profiles FOR ALL
  TO authenticated
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin());

-- Ensure admin420 has a profile
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

-- Update admin420's metadata
UPDATE auth.users
SET 
  raw_app_meta_data = jsonb_build_object(
    'provider', 'username',
    'providers', array['username'],
    'username', 'admin420',
    'role', 'admin'
  ),
  raw_user_meta_data = jsonb_build_object(
    'username', 'admin420',
    'role', 'admin'
  )
WHERE email = 'admin420@merchant.local';

-- Grant necessary permissions
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