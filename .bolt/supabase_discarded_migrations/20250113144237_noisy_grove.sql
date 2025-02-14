-- Drop existing category policies
DROP POLICY IF EXISTS "categories_read" ON categories;
DROP POLICY IF EXISTS "categories_insert" ON categories;
DROP POLICY IF EXISTS "categories_update" ON categories;
DROP POLICY IF EXISTS "categories_delete" ON categories;

-- Create fresh policies for categories
CREATE POLICY "categories_read"
  ON categories FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = categories.collection_id
      AND (collections.visible = true OR collections.user_id = auth.uid())
    )
  );

CREATE POLICY "categories_insert"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_id
      AND collections.user_id = auth.uid()
    )
  );

CREATE POLICY "categories_update"
  ON categories FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = categories.collection_id
      AND collections.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = categories.collection_id
      AND collections.user_id = auth.uid()
    )
  );

CREATE POLICY "categories_delete"
  ON categories FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = categories.collection_id
      AND collections.user_id = auth.uid()
    )
  );

-- Create helper function to check category access
CREATE OR REPLACE FUNCTION check_category_access(category_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM categories c
    JOIN collections col ON col.id = c.collection_id
    WHERE c.id = category_id
    AND col.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;