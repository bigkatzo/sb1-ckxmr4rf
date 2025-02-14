-- Drop existing admin function to recreate
DROP FUNCTION IF EXISTS auth.is_admin() CASCADE;

-- Create admin check function that handles missing profile
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
DECLARE
  v_user_id uuid;
  v_is_admin boolean;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  -- Check if user is admin420
  v_is_admin := current_setting('request.jwt.claims', true)::jsonb->>'email' = 'admin420@merchant.local';
  
  IF v_is_admin AND v_user_id IS NOT NULL THEN
    -- Ensure admin profile exists
    INSERT INTO user_profiles (id, role)
    VALUES (v_user_id, 'admin')
    ON CONFLICT (id) DO UPDATE 
    SET role = 'admin'
    WHERE user_profiles.id = v_user_id;
    
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to manage user roles
CREATE OR REPLACE FUNCTION manage_user_role(
  p_user_id uuid,
  p_role text
)
RETURNS void AS $$
BEGIN
  -- Verify caller is admin
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin can manage user roles';
  END IF;

  -- Validate role
  IF p_role NOT IN ('admin', 'merchant', 'user') THEN
    RAISE EXCEPTION 'Invalid role. Must be admin, merchant, or user';
  END IF;

  -- Update or insert user profile
  INSERT INTO user_profiles (id, role)
  VALUES (p_user_id, p_role)
  ON CONFLICT (id) DO UPDATE 
  SET 
    role = EXCLUDED.role,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user has merchant access
CREATE OR REPLACE FUNCTION auth.is_merchant()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND (role = 'merchant' OR role = 'admin')
  ) OR auth.is_admin();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS policies for user_profiles
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

-- Ensure admin420 has correct profile and role
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
    -- Update auth.users
    UPDATE auth.users
    SET 
      role = 'authenticated',
      raw_app_meta_data = jsonb_build_object(
        'provider', 'username',
        'providers', array['username'],
        'username', 'admin420'
      ),
      raw_user_meta_data = jsonb_build_object(
        'username', 'admin420'
      )
    WHERE id = v_admin_id;

    -- Create or update admin profile
    INSERT INTO user_profiles (id, role)
    VALUES (v_admin_id, 'admin')
    ON CONFLICT (id) DO UPDATE 
    SET role = 'admin';
  END IF;
END $$;

-- Update collection access policies
DROP POLICY IF EXISTS "auth_manage_collections" ON collections;
CREATE POLICY "auth_manage_collections"
  ON collections FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid()
    OR auth.is_admin()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'merchant'
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR auth.is_admin()
  );

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_merchant() TO authenticated;
GRANT EXECUTE ON FUNCTION manage_user_role(uuid, text) TO authenticated;
GRANT ALL ON user_profiles TO authenticated;