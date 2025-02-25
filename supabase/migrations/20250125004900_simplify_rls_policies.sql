-- Start transaction
BEGIN;

-- Drop all existing policies
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

-- Create admin check function if it doesn't exist
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

-- Enable RLS
ALTER TABLE collection_access ENABLE ROW LEVEL SECURITY;

-- Create three separate policies

-- 1. Users can see their own access records
CREATE POLICY "user_own_access"
ON collection_access
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 2. Collection owners can manage their collection access
CREATE POLICY "owner_manage_access"
ON collection_access
FOR ALL
TO authenticated
USING (
  collection_id IN (
    SELECT id 
    FROM collections 
    WHERE user_id = auth.uid()
  )
);

-- 3. Admins can do everything (separate policy)
CREATE POLICY "admin_full_access"
ON collection_access
FOR ALL
TO authenticated
USING (is_admin());

-- Verify policies were created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'collection_access' 
    AND policyname IN (
      'user_own_access',
      'owner_manage_access',
      'admin_full_access'
    )
  ) THEN
    RAISE EXCEPTION 'Policies not created properly';
  END IF;
END $$;

COMMIT; 