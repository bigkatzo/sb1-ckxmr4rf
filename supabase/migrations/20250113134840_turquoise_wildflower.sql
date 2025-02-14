-- Drop existing collections policies
DROP POLICY IF EXISTS "Collections read" ON collections;
DROP POLICY IF EXISTS "Collections write" ON collections;
DROP POLICY IF EXISTS "Collections access" ON collections;

-- Create new collections policies with unique names
CREATE POLICY "Collection view policy"
  ON collections FOR SELECT
  USING (
    visible = true 
    OR auth.has_collection_access(id)
  );

CREATE POLICY "Collection manage policy"
  ON collections FOR ALL
  TO authenticated
  USING (auth.is_merchant())
  WITH CHECK (auth.is_merchant());