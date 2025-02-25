-- Start transaction
BEGIN;

-- Drop existing policies and views
DROP POLICY IF EXISTS "Users can view their own collection access" ON collection_access;
DROP POLICY IF EXISTS "Collection owners can manage access" ON collection_access;
DROP POLICY IF EXISTS "Admins can manage all access" ON collection_access;
DROP POLICY IF EXISTS "Collection access view policy" ON collection_access;
DROP POLICY IF EXISTS "Collection access insert policy" ON collection_access;
DROP POLICY IF EXISTS "Collection access update policy" ON collection_access;
DROP POLICY IF EXISTS "Collection access delete policy" ON collection_access;
DROP POLICY IF EXISTS "Collection access modify policy" ON collection_access;

DROP MATERIALIZED VIEW IF EXISTS collection_ownership;
DROP FUNCTION IF EXISTS refresh_collection_ownership() CASCADE;

-- Create admin check function
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
$$;

-- Create collection owner check function
CREATE OR REPLACE FUNCTION is_collection_owner(collection_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM collections
    WHERE id = collection_id
    AND user_id = auth.uid()
  );
$$;

-- Enable RLS
ALTER TABLE collection_access ENABLE ROW LEVEL SECURITY;

-- Create basic policies
CREATE POLICY "Collection access basic policy"
ON collection_access
FOR ALL
TO authenticated
USING (
  -- User can access their own records
  user_id = auth.uid()
  OR
  -- Collection owners can access records for their collections
  is_collection_owner(collection_id)
  OR
  -- Admins can access all records
  is_admin()
);

-- Verify policy was created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'collection_access' 
    AND policyname = 'Collection access basic policy'
  ) THEN
    RAISE EXCEPTION 'Policy creation failed';
  END IF;
END $$;

COMMIT; 