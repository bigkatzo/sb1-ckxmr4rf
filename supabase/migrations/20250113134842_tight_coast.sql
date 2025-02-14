-- Drop existing products policies
DROP POLICY IF EXISTS "Products read" ON products;
DROP POLICY IF EXISTS "Products write" ON products;
DROP POLICY IF EXISTS "Products access" ON products;

-- Create new products policies with unique names
CREATE POLICY "Product view policy"
  ON products FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND (c.visible = true OR auth.has_collection_access(c.id))
    )
  );

CREATE POLICY "Product manage policy"
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