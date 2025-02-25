-- Start transaction
BEGIN;

-- Drop existing collection policies
DROP POLICY IF EXISTS "collections_view" ON collections;
DROP POLICY IF EXISTS "collections_edit" ON collections;
DROP POLICY IF EXISTS "collections_insert" ON collections;
DROP POLICY IF EXISTS "collections_update" ON collections;
DROP POLICY IF EXISTS "collections_delete" ON collections;
DROP POLICY IF EXISTS "collections_policy" ON collections;

-- Enable RLS
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

-- 1. View policy (public + authenticated)
CREATE POLICY "collections_view"
ON collections
FOR SELECT
USING (
  -- Public can view visible collections
  visible = true
  OR
  -- Owners can view their collections
  user_id = auth.uid()
  OR
  -- Users with access can view collections
  EXISTS (
    SELECT 1 FROM collection_access
    WHERE collection_id = id
    AND user_id = auth.uid()
  )
  OR
  -- Admins can view all
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- 2. Insert policy (merchants + admins)
CREATE POLICY "collections_insert"
ON collections
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('merchant', 'admin')
  )
);

-- 3. Update policy
CREATE POLICY "collections_update"
ON collections
FOR UPDATE
TO authenticated
USING (
  -- Owners can update their collections
  user_id = auth.uid()
  OR
  -- Users with edit access can update
  EXISTS (
    SELECT 1 FROM collection_access
    WHERE collection_id = id
    AND user_id = auth.uid()
    AND access_type = 'edit'
  )
  OR
  -- Admins can update all
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- 4. Delete policy (owners + admins only)
CREATE POLICY "collections_delete"
ON collections
FOR DELETE
TO authenticated
USING (
  -- Only owners can delete their collections
  user_id = auth.uid()
  OR
  -- Admins can delete any collection
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
      'collections_view',
      'collections_insert',
      'collections_update',
      'collections_delete'
    )
  ) THEN
    RAISE EXCEPTION 'Collection policies not created properly';
  END IF;
END $$;

COMMIT; 