-- Start transaction
BEGIN;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own collection access" ON collection_access;
DROP POLICY IF EXISTS "Collection owners can manage access" ON collection_access;
DROP POLICY IF EXISTS "Admins can manage all access" ON collection_access;

-- Enable RLS
ALTER TABLE collection_access ENABLE ROW LEVEL SECURITY;

-- Create simplified policies
CREATE POLICY "Collection access view policy"
ON collection_access
FOR SELECT
TO authenticated
USING (
  -- User can view their own access records
  user_id = auth.uid()
  OR
  -- Collection owners can view all access records for their collections
  collection_id IN (
    SELECT id FROM collections WHERE user_id = auth.uid()
  )
  OR
  -- Admins can view all
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Collection access insert policy"
ON collection_access
FOR INSERT
TO authenticated
WITH CHECK (
  -- Collection owners can add access records
  collection_id IN (
    SELECT id FROM collections WHERE user_id = auth.uid()
  )
  OR
  -- Admins can add access records
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Collection access update policy"
ON collection_access
FOR UPDATE
TO authenticated
USING (
  -- Collection owners can update access records
  collection_id IN (
    SELECT id FROM collections WHERE user_id = auth.uid()
  )
  OR
  -- Admins can update access records
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  -- Collection owners can update access records
  collection_id IN (
    SELECT id FROM collections WHERE user_id = auth.uid()
  )
  OR
  -- Admins can update access records
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Collection access delete policy"
ON collection_access
FOR DELETE
TO authenticated
USING (
  -- Collection owners can delete access records
  collection_id IN (
    SELECT id FROM collections WHERE user_id = auth.uid()
  )
  OR
  -- Admins can delete access records
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Verify policies were created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'collection_access' 
    AND policyname IN (
      'Collection access view policy',
      'Collection access insert policy',
      'Collection access update policy',
      'Collection access delete policy'
    )
  ) THEN
    RAISE EXCEPTION 'Policy creation failed';
  END IF;
END $$;

COMMIT; 