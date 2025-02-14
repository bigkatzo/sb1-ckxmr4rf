-- Drop existing admin function
DROP FUNCTION IF EXISTS auth.is_admin() CASCADE;

-- Create simplified admin check function that only checks email
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN current_setting('request.jwt.claims', true)::jsonb->>'email' = 'admin420@merchant.local';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove all role-specific metadata and permissions
UPDATE auth.users
SET 
  raw_app_meta_data = jsonb_build_object(
    'provider', 'username',
    'providers', array['username']
  ),
  raw_user_meta_data = jsonb_build_object(
    'username', 'admin420'
  ),
  role = 'authenticated'
WHERE email = 'admin420@merchant.local';

-- Revoke any problematic permissions
REVOKE ALL ON ALL TABLES IN SCHEMA auth FROM authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA auth FROM authenticated;

-- Grant only necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Update RLS policies to use simplified admin check
DROP POLICY IF EXISTS "collections_policy" ON collections;
CREATE POLICY "collections_policy"
  ON collections
  USING (
    visible = true 
    OR auth.uid() = user_id
    OR auth.is_admin()
  )
  WITH CHECK (
    auth.uid() = user_id
    OR auth.is_admin()
  );

DROP POLICY IF EXISTS "products_policy" ON products;
CREATE POLICY "products_policy"
  ON products
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
  ON categories
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