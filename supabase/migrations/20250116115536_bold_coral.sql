-- First drop all dependent policies
DROP POLICY IF EXISTS "view_own_access" ON user_collection_access;
DROP POLICY IF EXISTS "admin_manage_access" ON user_collection_access;
DROP POLICY IF EXISTS "products_policy" ON products;
DROP POLICY IF EXISTS "categories_policy" ON categories;
DROP POLICY IF EXISTS "collections_policy" ON collections;

-- Now we can safely drop the functions
DROP FUNCTION IF EXISTS is_admin() CASCADE;
DROP FUNCTION IF EXISTS manage_user_role(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS manage_user_role(uuid, user_role) CASCADE;

-- Create admin check function that uses email directly
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN current_setting('request.jwt.claims', true)::jsonb->>'email' = 'admin420@merchant.local';
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
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only admin can manage user roles';
  END IF;

  -- Update or insert user profile
  INSERT INTO user_profiles (id, role)
  VALUES (p_user_id, p_role)
  ON CONFLICT (id) 
  DO UPDATE SET 
    role = p_role,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update admin420's metadata and permissions
UPDATE auth.users
SET 
  raw_app_meta_data = jsonb_build_object(
    'provider', 'username',
    'providers', array['username'],
    'username', 'admin420'
  ),
  raw_user_meta_data = jsonb_build_object(
    'username', 'admin420'
  ),
  role = 'authenticated'
WHERE email = 'admin420@merchant.local';

-- Ensure admin420 has a profile
INSERT INTO user_profiles (id, role)
SELECT id, 'admin'
FROM auth.users 
WHERE email = 'admin420@merchant.local'
ON CONFLICT (id) DO UPDATE 
SET role = 'admin';

-- Update RLS policies
DROP POLICY IF EXISTS "view_own_profile" ON user_profiles;
CREATE POLICY "view_own_profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() 
    OR is_admin()
  );

DROP POLICY IF EXISTS "admin_manage_profiles" ON user_profiles;
CREATE POLICY "admin_manage_profiles"
  ON user_profiles FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Recreate collection-related policies
CREATE POLICY "collections_policy"
  ON collections
  USING (
    visible = true 
    OR user_id = auth.uid()
    OR is_admin()
  )
  WITH CHECK (
    user_id = auth.uid()
    OR is_admin()
  );

CREATE POLICY "products_policy"
  ON products
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND (
        c.visible = true 
        OR c.user_id = auth.uid()
        OR is_admin()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND (
        c.user_id = auth.uid()
        OR is_admin()
      )
    )
  );

CREATE POLICY "categories_policy"
  ON categories
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND (
        c.visible = true 
        OR c.user_id = auth.uid()
        OR is_admin()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND (
        c.user_id = auth.uid()
        OR is_admin()
      )
    )
  );

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT ALL ON user_profiles TO authenticated;