-- Start transaction
BEGIN;

-- Drop existing policy
DROP POLICY IF EXISTS "collection_access_combined" ON collection_access;

-- Enable RLS
ALTER TABLE collection_access ENABLE ROW LEVEL SECURITY;

-- Create separate policies for different operations

-- 1. SELECT policy - users can view if they:
-- - have any access_type for the collection
-- - own the collection
-- - are an admin
CREATE POLICY "collection_access_view"
ON collection_access
FOR SELECT
TO authenticated
USING (
  -- Direct user check (can see own access)
  user_id = auth.uid()
  OR
  -- Direct collection owner check
  EXISTS (
    SELECT 1 FROM collections c
    WHERE c.id = collection_id 
    AND c.user_id = auth.uid()
  )
  OR
  -- Direct admin check
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'admin'
  )
);

-- 2. INSERT/UPDATE/DELETE policy - users can modify if they:
-- - own the collection
-- - are an admin
-- - have 'edit' access_type for the collection
CREATE POLICY "collection_access_modify"
ON collection_access
FOR ALL
TO authenticated
USING (
  -- Direct collection owner check
  EXISTS (
    SELECT 1 FROM collections c
    WHERE c.id = collection_id 
    AND c.user_id = auth.uid()
  )
  OR
  -- Direct admin check
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'admin'
  )
  OR
  -- Check for edit permission
  EXISTS (
    SELECT 1 FROM collection_access ca
    WHERE ca.collection_id = collection_access.collection_id
    AND ca.user_id = auth.uid()
    AND ca.access_type = 'edit'
  )
);

-- Maintain existing indexes
CREATE INDEX IF NOT EXISTS idx_collections_user_id ON collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collection_access_collection_id ON collection_access(collection_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(id) WHERE role = 'admin';
-- Add index for access_type checks
CREATE INDEX IF NOT EXISTS idx_collection_access_user_type ON collection_access(user_id, access_type);

-- Verify policies were created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'collection_access' 
    AND policyname IN ('collection_access_view', 'collection_access_modify')
  ) THEN
    RAISE EXCEPTION 'Policies not created properly';
  END IF;
END $$;

COMMIT; 