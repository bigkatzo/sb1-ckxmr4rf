-- Drop any existing admin-related functions
DROP FUNCTION IF EXISTS auth.is_admin() CASCADE;

-- Create admin check function that only recognizes admin420
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (
    SELECT email = 'admin420@merchant.local'
    FROM auth.users
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update admin420's metadata if exists
UPDATE auth.users
SET 
  raw_app_meta_data = jsonb_build_object(
    'provider', 'username',
    'providers', array['username'],
    'role', 'supabase_admin',
    'username', 'admin420'
  ),
  raw_user_meta_data = jsonb_build_object(
    'username', 'admin420',
    'role', 'supabase_admin'
  )
WHERE email = 'admin420@merchant.local';

-- Update RLS policies to give admin420 full access
DROP POLICY IF EXISTS "Collection manage policy" ON collections;
CREATE POLICY "Collection manage policy"
  ON collections FOR ALL
  TO authenticated
  USING (
    auth.is_admin() OR user_id = auth.uid()
  )
  WITH CHECK (
    auth.is_admin() OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Product manage policy" ON products;
CREATE POLICY "Product manage policy"
  ON products FOR ALL
  TO authenticated
  USING (
    auth.is_admin() OR EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.is_admin() OR EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Category manage policy" ON categories;
CREATE POLICY "Category manage policy"
  ON categories FOR ALL
  TO authenticated
  USING (
    auth.is_admin() OR EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.is_admin() OR EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND c.user_id = auth.uid()
    )
  );

-- Grant full access to storage for admin420
DROP POLICY IF EXISTS "Storage public read" ON storage.objects;
DROP POLICY IF EXISTS "Storage authenticated write" ON storage.objects;
DROP POLICY IF EXISTS "Storage authenticated modify" ON storage.objects;

CREATE POLICY "Storage access"
  ON storage.objects
  FOR ALL
  USING (
    bucket_id IN ('collection-images', 'product-images')
    AND (auth.is_admin() OR auth.role() = 'authenticated')
  )
  WITH CHECK (
    bucket_id IN ('collection-images', 'product-images')
    AND (auth.is_admin() OR auth.role() = 'authenticated')
  );