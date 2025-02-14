-- Drop existing admin function to recreate with proper permissions
DROP FUNCTION IF EXISTS auth.is_admin() CASCADE;

-- Create admin check function that uses email directly
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  -- Use direct email check for simplicity and reliability
  RETURN current_setting('request.jwt.claims', true)::jsonb->>'email' = 'admin420@merchant.local';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update admin420's role and metadata
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
WHERE email = 'admin420@merchant.local';

-- Ensure admin420 has admin profile
INSERT INTO user_profiles (id, role)
SELECT id, 'admin'
FROM auth.users 
WHERE email = 'admin420@merchant.local'
ON CONFLICT (id) DO UPDATE 
SET role = 'admin';

-- Update RLS policies to be more permissive
DROP POLICY IF EXISTS "collections_policy" ON collections;
CREATE POLICY "collections_policy"
  ON collections FOR ALL
  USING (
    visible = true 
    OR user_id = auth.uid()
    OR auth.is_admin()
  )
  WITH CHECK (
    user_id = auth.uid()
    OR auth.is_admin()
  );

DROP POLICY IF EXISTS "products_policy" ON products;
CREATE POLICY "products_policy"
  ON products FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND (
        c.visible = true 
        OR c.user_id = auth.uid()
        OR auth.is_admin()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND (
        c.user_id = auth.uid()
        OR auth.is_admin()
      )
    )
  );

DROP POLICY IF EXISTS "categories_policy" ON categories;
CREATE POLICY "categories_policy"
  ON categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND (
        c.visible = true 
        OR c.user_id = auth.uid()
        OR auth.is_admin()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND (
        c.user_id = auth.uid()
        OR auth.is_admin()
      )
    )
  );

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated;
GRANT ALL ON user_profiles TO authenticated;
GRANT ALL ON collections TO authenticated;
GRANT ALL ON products TO authenticated;
GRANT ALL ON categories TO authenticated;

-- Create public policies for anonymous access
CREATE POLICY "public_view_collections"
  ON collections FOR SELECT
  TO public
  USING (visible = true);

CREATE POLICY "public_view_products"
  ON products FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND c.visible = true
    )
  );

CREATE POLICY "public_view_categories"
  ON categories FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND c.visible = true
    )
  );