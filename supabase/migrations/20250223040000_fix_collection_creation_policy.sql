-- Start transaction
BEGIN;

-- Drop ALL existing collection insert policies to avoid conflicts
DROP POLICY IF EXISTS "collections_insert" ON collections;
DROP POLICY IF EXISTS "collections_dashboard_modify" ON collections;
DROP POLICY IF EXISTS "collections_policy" ON collections;
DROP POLICY IF EXISTS "merchant_manage_collections" ON collections;
DROP POLICY IF EXISTS "Users can insert their own collections" ON collections;

-- Create two separate policies:
-- 1. For creation (INSERT)
CREATE POLICY "collections_insert_policy"
ON collections
FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('merchant', 'admin')
  )
  AND
  -- Ensure user can only set themselves as owner
  user_id = auth.uid()
);

-- 2. For modification (UPDATE, DELETE)
CREATE POLICY "collections_modify_policy"
ON collections
FOR ALL
TO authenticated
USING (
  -- Owners can modify their collections
  user_id = auth.uid()
  OR
  -- Users with edit access can modify
  EXISTS (
    SELECT 1 FROM collection_access
    WHERE collection_id = id
    AND user_id = auth.uid()
    AND access_type = 'edit'
  )
  OR
  -- Admins can modify all
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- Verify policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'collections'
    AND policyname IN (
      'collections_insert_policy',
      'collections_modify_policy'
    )
  ) THEN
    RAISE EXCEPTION 'Collection policies not created properly';
  END IF;
END $$;

COMMIT; 