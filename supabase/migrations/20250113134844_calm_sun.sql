-- Drop existing categories policies
DROP POLICY IF EXISTS "Categories read" ON categories;
DROP POLICY IF EXISTS "Categories write" ON categories;
DROP POLICY IF EXISTS "Categories access" ON categories;

-- Create new categories policies with unique names
CREATE POLICY "Category view policy"
  ON categories FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND (c.visible = true OR auth.has_collection_access(c.id))
    )
  );

CREATE POLICY "Category manage policy"
  ON categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND auth.is_merchant()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND auth.is_merchant()
    )
  );