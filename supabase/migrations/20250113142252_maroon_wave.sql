-- Drop existing policies to start fresh
DO $$ BEGIN
  DROP POLICY IF EXISTS "Collection view policy" ON collections;
  DROP POLICY IF EXISTS "Collection manage policy" ON collections;
  DROP POLICY IF EXISTS "Product view policy" ON products;
  DROP POLICY IF EXISTS "Product manage policy" ON products;
  DROP POLICY IF EXISTS "Category view policy" ON categories;
  DROP POLICY IF EXISTS "Category manage policy" ON categories;
  DROP POLICY IF EXISTS "Storage access" ON storage.objects;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create admin check function
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

-- Create collection policies
CREATE POLICY "Collection view policy"
  ON collections FOR SELECT
  USING (
    visible = true 
    OR auth.is_admin() 
    OR user_id = auth.uid()
  );

CREATE POLICY "Collection manage policy"
  ON collections FOR ALL
  TO authenticated
  USING (auth.is_admin() OR user_id = auth.uid())
  WITH CHECK (auth.is_admin() OR user_id = auth.uid());

-- Create product policies
CREATE POLICY "Product view policy"
  ON products FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND (c.visible = true OR auth.is_admin() OR c.user_id = auth.uid())
    )
  );

CREATE POLICY "Product manage policy"
  ON products FOR ALL
  TO authenticated
  USING (auth.is_admin() OR EXISTS (
    SELECT 1 FROM collections c
    WHERE c.id = products.collection_id
    AND c.user_id = auth.uid()
  ))
  WITH CHECK (auth.is_admin() OR EXISTS (
    SELECT 1 FROM collections c
    WHERE c.id = products.collection_id
    AND c.user_id = auth.uid()
  ));

-- Create category policies
CREATE POLICY "Category view policy"
  ON categories FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND (c.visible = true OR auth.is_admin() OR c.user_id = auth.uid())
    )
  );

CREATE POLICY "Category manage policy"
  ON categories FOR ALL
  TO authenticated
  USING (auth.is_admin() OR EXISTS (
    SELECT 1 FROM collections c
    WHERE c.id = categories.collection_id
    AND c.user_id = auth.uid()
  ))
  WITH CHECK (auth.is_admin() OR EXISTS (
    SELECT 1 FROM collections c
    WHERE c.id = categories.collection_id
    AND c.user_id = auth.uid()
  ));

-- Create storage policy
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

-- Grant necessary permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;