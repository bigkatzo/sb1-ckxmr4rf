-- Drop existing products policies
DROP POLICY IF EXISTS "Products read" ON products;
DROP POLICY IF EXISTS "Products write" ON products;

-- Create new products policies
CREATE POLICY "Products view"
  ON products FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND (c.visible = true OR auth.has_collection_access(c.id))
    )
  );

CREATE POLICY "Products manage"
  ON products FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND auth.is_merchant()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND auth.is_merchant()
    )
  );