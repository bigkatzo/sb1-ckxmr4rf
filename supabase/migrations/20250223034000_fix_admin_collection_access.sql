-- Start transaction
BEGIN;

-- Drop existing collection policies
DROP POLICY IF EXISTS "collections_view" ON collections;
DROP POLICY IF EXISTS "collections_edit" ON collections;
DROP POLICY IF EXISTS "collections_update" ON collections;
DROP POLICY IF EXISTS "collections_delete" ON collections;
DROP POLICY IF EXISTS "collections_insert" ON collections;

-- Create updated policies that properly include admin access
CREATE POLICY "collections_view"
  ON collections
  FOR SELECT
  TO authenticated
  USING (
    -- Admin can view all collections
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'admin'
    )
    OR
    -- User owns the collection
    user_id = auth.uid()
    OR 
    -- User has any type of access to the collection
    EXISTS (
      SELECT 1 FROM collection_access ca
      WHERE ca.collection_id = collections.id
      AND ca.user_id = auth.uid()
      AND ca.access_type IN ('view', 'edit')
    )
  );

-- Separate update and delete policies
CREATE POLICY "collections_update"
  ON collections
  FOR UPDATE
  TO authenticated
  USING (
    -- Admin can edit any collection
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'admin'
    )
    OR
    -- Owner can edit their collections
    user_id = auth.uid()
  );

CREATE POLICY "collections_delete"
  ON collections
  FOR DELETE
  TO authenticated
  USING (
    -- Admin can delete any collection
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'admin'
    )
    OR
    -- Owner can delete their collections
    user_id = auth.uid()
  );

-- Create insert policy
CREATE POLICY "collections_insert"
  ON collections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admin can insert
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'admin'
    )
    OR
    -- Owner can insert (user_id must match auth.uid())
    user_id = auth.uid()
  );

-- Verify policies were created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'collections' 
    AND policyname IN (
      'collections_view',
      'collections_update',
      'collections_delete',
      'collections_insert'
    )
  ) THEN
    RAISE EXCEPTION 'Policy creation failed';
  END IF;
END $$;

COMMIT; 