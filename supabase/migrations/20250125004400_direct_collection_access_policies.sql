-- Start transaction
BEGIN;

-- Drop everything from previous attempts
DROP POLICY IF EXISTS "Users can view their own collection access" ON collection_access;
DROP POLICY IF EXISTS "Collection owners can manage access" ON collection_access;
DROP POLICY IF EXISTS "Admins can manage all access" ON collection_access;
DROP POLICY IF EXISTS "Collection access view policy" ON collection_access;
DROP POLICY IF EXISTS "Collection access insert policy" ON collection_access;
DROP POLICY IF EXISTS "Collection access update policy" ON collection_access;
DROP POLICY IF EXISTS "Collection access delete policy" ON collection_access;
DROP POLICY IF EXISTS "Collection access modify policy" ON collection_access;
DROP POLICY IF EXISTS "Collection access basic policy" ON collection_access;

DROP MATERIALIZED VIEW IF EXISTS collection_ownership;
DROP FUNCTION IF EXISTS refresh_collection_ownership() CASCADE;
DROP FUNCTION IF EXISTS is_admin() CASCADE;
DROP FUNCTION IF EXISTS is_collection_owner(uuid) CASCADE;

-- Enable RLS
ALTER TABLE collection_access ENABLE ROW LEVEL SECURITY;

-- Create separate policies for different user types
CREATE POLICY "Users view own access"
ON collection_access
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Collection owners manage access"
ON collection_access
FOR ALL
TO authenticated
USING (
  collection_id IN (
    SELECT id FROM collections WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins manage all access"
ON collection_access
FOR ALL
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM user_profiles WHERE role = 'admin'
  )
);

-- Verify policies were created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'collection_access' 
    AND policyname IN (
      'Users view own access',
      'Collection owners manage access',
      'Admins manage all access'
    )
  ) THEN
    RAISE EXCEPTION 'Policy creation failed';
  END IF;
END $$;

COMMIT; 