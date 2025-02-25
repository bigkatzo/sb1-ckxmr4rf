-- Start transaction
BEGIN;

-- Drop existing policies
DROP POLICY IF EXISTS "collection_access_combined" ON collection_access;
DROP POLICY IF EXISTS "collection_access_view" ON collection_access;
DROP POLICY IF EXISTS "collection_access_modify" ON collection_access;
DROP POLICY IF EXISTS "collections_view" ON collections;
DROP POLICY IF EXISTS "collections_edit" ON collections;
DROP POLICY IF EXISTS "collections_policy" ON collections;
DROP POLICY IF EXISTS "collections_modify" ON collections;

-- Enable RLS
ALTER TABLE collection_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

-- 1. Collection Access Policies (Merchant Dashboard Only)
CREATE POLICY "collection_access_view"
ON collection_access
FOR SELECT
TO authenticated
USING (
  -- Users can see their own access records
  user_id = auth.uid()
  OR
  -- Collection owners can see all access records for their collections
  collection_owner_id = auth.uid()
  OR
  -- Admins can see all
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'admin'
  )
);

CREATE POLICY "collection_access_modify"
ON collection_access
FOR ALL
TO authenticated
USING (
  -- Collection owners can modify access
  collection_owner_id = auth.uid()
  OR
  -- Admins can modify all
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'admin'
  )
);

-- 2. Collections Policies

-- 2.1 Storefront Policies (Public Access)
CREATE POLICY "collections_storefront_view"
ON collections
FOR SELECT
TO public
USING (
  -- Only show collections marked as visible to the public
  visible = true
);

-- 2.2 Merchant Dashboard Policies (Authenticated Access)
CREATE POLICY "collections_merchant_view"
ON collections
FOR SELECT
TO authenticated
USING (
  -- Users can view collections they own
  user_id = auth.uid()
  OR
  -- Users can view collections they have access to
  EXISTS (
    SELECT 1 FROM collection_access ca
    WHERE ca.collection_id = id
    AND ca.user_id = auth.uid()
  )
  OR
  -- Admins can view all
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'admin'
  )
);

CREATE POLICY "collections_merchant_modify"
ON collections
FOR ALL
TO authenticated
USING (
  -- Users can modify their own collections
  user_id = auth.uid()
  OR
  -- Users with edit access can modify
  EXISTS (
    SELECT 1 FROM collection_access ca
    WHERE ca.collection_id = id
    AND ca.user_id = auth.uid()
    AND ca.access_type = 'edit'
  )
  OR
  -- Admins can modify all
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'admin'
  )
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_collections_user_id ON collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collections_visible ON collections(visible);
CREATE INDEX IF NOT EXISTS idx_collection_access_collection_id ON collection_access(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_access_owner_id ON collection_access(collection_owner_id);
CREATE INDEX IF NOT EXISTS idx_collection_access_user_type ON collection_access(user_id, access_type);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(id) WHERE role = 'admin';

-- Verify policies were created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename IN ('collection_access', 'collections')
    AND policyname IN (
      'collection_access_view',
      'collection_access_modify',
      'collections_storefront_view',
      'collections_merchant_view',
      'collections_merchant_modify'
    )
  ) THEN
    RAISE EXCEPTION 'Policies not created properly';
  END IF;
END $$;

COMMIT; 