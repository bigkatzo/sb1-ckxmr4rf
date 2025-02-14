-- Drop existing admin function
DROP FUNCTION IF EXISTS auth.is_admin() CASCADE;

-- Create admin check function that uses custom flag
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND email = 'admin420@merchant.local'
    AND raw_app_meta_data->>'is_admin' = 'true'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update admin420's metadata with custom admin flag
UPDATE auth.users
SET 
  raw_app_meta_data = jsonb_build_object(
    'provider', 'username',
    'providers', array['username'],
    'is_admin', true
  ),
  raw_user_meta_data = jsonb_build_object(
    'is_admin', true
  )
WHERE email = 'admin420@merchant.local';

-- Grant necessary permissions to authenticated role
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Update RLS policies to use custom admin check
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