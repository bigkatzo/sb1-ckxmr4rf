-- Fix missing auth.get_admin_id() function error
BEGIN;

-- Drop any old triggers that might be causing issues
DROP TRIGGER IF EXISTS ensure_collection_user_id ON collections;
DROP TRIGGER IF EXISTS collection_user_id_trigger ON collections;

-- Drop any old functions that might be causing issues
DROP FUNCTION IF EXISTS set_collection_user_id() CASCADE;
DROP FUNCTION IF EXISTS auth.get_admin_id() CASCADE;

-- Ensure collections table has proper RLS policies for creation
-- Drop existing policies first
DROP POLICY IF EXISTS "collections_insert" ON collections;
DROP POLICY IF EXISTS "collections_insert_policy" ON collections;

-- Create a simple, working insert policy for collections
CREATE POLICY "collections_insert_policy"
ON collections
FOR INSERT 
TO authenticated
WITH CHECK (
  -- Users can create collections if they are merchants or admins
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('merchant', 'admin')
  )
  AND
  -- Ensure user_id is set to the authenticated user
  user_id = auth.uid()
);

-- Verify the policy was created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'collections'
    AND policyname = 'collections_insert_policy'
  ) THEN
    RAISE EXCEPTION 'Collection insert policy not created properly';
  END IF;
END $$;

COMMIT; 