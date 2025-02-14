-- Drop existing admin function to recreate
DROP FUNCTION IF EXISTS auth.is_admin() CASCADE;

-- Create admin check function that handles missing profile
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  -- First check if user is admin420
  IF current_setting('request.jwt.claims', true)::jsonb->>'email' = 'admin420@merchant.local' THEN
    -- Ensure admin profile exists
    INSERT INTO user_profiles (id, role)
    SELECT auth.uid(), 'admin'
    ON CONFLICT (id) DO UPDATE SET role = 'admin'
    WHERE auth.uid() IS NOT NULL;
    
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- Update RLS policies for user_profiles
DROP POLICY IF EXISTS "view_own_profile" ON user_profiles;
CREATE POLICY "view_own_profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() 
    OR current_setting('request.jwt.claims', true)::jsonb->>'email' = 'admin420@merchant.local'
  );

DROP POLICY IF EXISTS "admin_manage_profiles" ON user_profiles;
CREATE POLICY "admin_manage_profiles"
  ON user_profiles FOR ALL
  TO authenticated
  USING (current_setting('request.jwt.claims', true)::jsonb->>'email' = 'admin420@merchant.local')
  WITH CHECK (current_setting('request.jwt.claims', true)::jsonb->>'email' = 'admin420@merchant.local');

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated;
GRANT ALL ON user_profiles TO authenticated;