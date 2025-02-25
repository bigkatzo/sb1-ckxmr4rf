-- Start transaction
BEGIN;

-- Backup existing policies
CREATE TEMP TABLE IF NOT EXISTS policy_backup AS
SELECT 
    schemaname,
    tablename,
    policyname,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'collection_access';

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own collection access" ON collection_access;
DROP POLICY IF EXISTS "Collection owners can manage access" ON collection_access;
DROP POLICY IF EXISTS "Admins can manage all access" ON collection_access;

-- Enable RLS
ALTER TABLE collection_access ENABLE ROW LEVEL SECURITY;

-- Create policies for collection_access table
CREATE POLICY "Users can view their own collection access"
ON collection_access
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM collections
    WHERE collections.id = collection_access.collection_id
    AND collections.user_id = auth.uid()
  )
);

CREATE POLICY "Collection owners can manage access"
ON collection_access
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM collections
    WHERE collections.id = collection_access.collection_id
    AND collections.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage all access"
ON collection_access
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
);

-- Verify policies were created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'collection_access' 
    AND policyname IN (
      'Users can view their own collection access',
      'Collection owners can manage access',
      'Admins can manage all access'
    )
  ) THEN
    RAISE EXCEPTION 'Policy creation failed';
  END IF;
END $$;

-- If we get here, commit the transaction
COMMIT; 