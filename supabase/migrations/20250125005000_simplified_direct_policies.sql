-- Start transaction
BEGIN;

-- Drop all existing policies and functions
DROP POLICY IF EXISTS "Users can view their own collection access" ON collection_access;
DROP POLICY IF EXISTS "Collection owners can manage access" ON collection_access;
DROP POLICY IF EXISTS "Admins can manage all access" ON collection_access;
DROP POLICY IF EXISTS "Collection access view policy" ON collection_access;
DROP POLICY IF EXISTS "Collection access insert policy" ON collection_access;
DROP POLICY IF EXISTS "Collection access update policy" ON collection_access;
DROP POLICY IF EXISTS "Collection access delete policy" ON collection_access;
DROP POLICY IF EXISTS "Collection access modify policy" ON collection_access;
DROP POLICY IF EXISTS "Collection access basic policy" ON collection_access;
DROP POLICY IF EXISTS "Users view own access" ON collection_access;
DROP POLICY IF EXISTS "collection_access_policy" ON collection_access;
DROP POLICY IF EXISTS "user_own_access" ON collection_access;
DROP POLICY IF EXISTS "owner_manage_access" ON collection_access;
DROP POLICY IF EXISTS "admin_full_access" ON collection_access;

-- Drop any existing functions
DROP FUNCTION IF EXISTS is_admin() CASCADE;
DROP FUNCTION IF EXISTS is_collection_owner(uuid) CASCADE;
DROP MATERIALIZED VIEW IF EXISTS collection_ownership CASCADE;

-- Enable RLS
ALTER TABLE collection_access ENABLE ROW LEVEL SECURITY;

-- Create a single, simple policy with direct checks
CREATE POLICY "collection_access_combined"
ON collection_access
FOR ALL
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

-- Create index to optimize the collection owner check
CREATE INDEX IF NOT EXISTS idx_collections_user_id ON collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collection_access_collection_id ON collection_access(collection_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(id) WHERE role = 'admin';

-- Verify policy was created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'collection_access' 
    AND policyname = 'collection_access_combined'
  ) THEN
    RAISE EXCEPTION 'Policy not created properly';
  END IF;
END $$;

COMMIT; 