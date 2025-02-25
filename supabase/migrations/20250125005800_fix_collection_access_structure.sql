-- Start transaction
BEGIN;

-- Ensure user_profiles has the correct role types
ALTER TABLE user_profiles
DROP CONSTRAINT IF EXISTS valid_role_types;

ALTER TABLE user_profiles
ADD CONSTRAINT valid_role_types
  CHECK (role IN ('user', 'merchant', 'admin'));

-- Clean up collection_access table
ALTER TABLE collection_access
DROP CONSTRAINT IF EXISTS valid_access_types;

ALTER TABLE collection_access
ADD CONSTRAINT valid_access_types
  CHECK (access_type IN ('view', 'edit'));

-- Add policy to ensure only merchants and admins can create collections
DROP POLICY IF EXISTS "collections_insert" ON collections;
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

-- Update collection access policies
DROP POLICY IF EXISTS "collection_access_view" ON collection_access;
DROP POLICY IF EXISTS "collection_access_modify" ON collection_access;

-- View policy - users can see their own access records
CREATE POLICY "collection_access_view"
ON collection_access
FOR SELECT
TO authenticated
USING (
  -- Users can see their own access records
  user_id = auth.uid()
  OR
  -- Collection owners can see all access records for their collections
  EXISTS (
    SELECT 1 FROM collections
    WHERE collections.id = collection_access.collection_id
    AND collections.user_id = auth.uid()
  )
  OR
  -- Admins can see all
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- Modify policy - only collection owners and admins can modify access
CREATE POLICY "collection_access_modify"
ON collection_access
FOR ALL
TO authenticated
USING (
  -- Collection owners can modify access
  EXISTS (
    SELECT 1 FROM collections
    WHERE collections.id = collection_access.collection_id
    AND collections.user_id = auth.uid()
  )
  OR
  -- Admins can modify all
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_collections_user_id ON collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collection_access_collection_id ON collection_access(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_access_user_id ON collection_access(user_id);
CREATE INDEX IF NOT EXISTS idx_collection_access_type ON collection_access(access_type);

-- Verify setup
DO $$
BEGIN
  -- Check constraints
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'user_profiles'
    AND constraint_name = 'valid_role_types'
  ) THEN
    RAISE EXCEPTION 'User profile role constraint not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'collection_access'
    AND constraint_name = 'valid_access_types'
  ) THEN
    RAISE EXCEPTION 'Collection access type constraint not created';
  END IF;

  -- Check policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'collections'
    AND policyname = 'collections_insert'
  ) THEN
    RAISE EXCEPTION 'Collections insert policy not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'collection_access'
    AND policyname IN ('collection_access_view', 'collection_access_modify')
  ) THEN
    RAISE EXCEPTION 'Collection access policies not created';
  END IF;
END $$;

COMMIT; 