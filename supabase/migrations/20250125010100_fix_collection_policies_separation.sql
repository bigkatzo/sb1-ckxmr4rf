-- Start transaction
BEGIN;

-- Drop existing problematic policies and functions
DROP POLICY IF EXISTS "collections_policy" ON collections;
DROP POLICY IF EXISTS "collections_view" ON collections;
DROP POLICY IF EXISTS "collections_merchant_view" ON collections;
DROP POLICY IF EXISTS "collections_storefront_view" ON collections;
DROP POLICY IF EXISTS "collection_access_view" ON collection_access;
DROP POLICY IF EXISTS "collection_access_modify" ON collection_access;
DROP FUNCTION IF EXISTS auth.has_collection_access(uuid) CASCADE;
DROP FUNCTION IF EXISTS auth.can_access_collection(uuid) CASCADE;
DROP FUNCTION IF EXISTS auth.get_collection_access(uuid) CASCADE;

-- 1. First, establish collection_access policies that don't depend on collections
CREATE POLICY "collection_access_view"
ON collection_access
FOR SELECT
TO authenticated
USING (
  -- Users can see their own access records
  user_id = auth.uid()
  OR
  -- Collection owners can see access records for their collections
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

-- 2. Then create separate storefront and dashboard policies for collections

-- 2.1 Public Storefront Policy
CREATE POLICY "collections_storefront_view"
ON collections
FOR SELECT
TO public
USING (
  -- Only show collections marked as visible to the public
  visible = true
);

-- 2.2 Merchant Dashboard Policies
CREATE POLICY "collections_merchant_view"
ON collections
FOR SELECT
TO authenticated
USING (
  -- Users can view collections they own
  user_id = auth.uid()
  OR
  -- Admins can view all
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'admin'
  )
  OR
  -- Users with explicit access can view
  EXISTS (
    SELECT 1 FROM collection_access ca
    WHERE ca.collection_id = id
    AND ca.user_id = auth.uid()
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
  -- Admins can modify all
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'admin'
  )
  OR
  -- Users with edit access can modify
  EXISTS (
    SELECT 1 FROM collection_access ca
    WHERE ca.collection_id = id
    AND ca.user_id = auth.uid()
    AND ca.access_type = 'edit'
  )
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_collection_access_user_collection 
ON collection_access(user_id, collection_id);

CREATE INDEX IF NOT EXISTS idx_collection_access_owner_collection 
ON collection_access(collection_owner_id, collection_id);

CREATE INDEX IF NOT EXISTS idx_collections_user_visibility 
ON collections(user_id, visible);

-- Verify policies were created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename IN ('collections', 'collection_access')
    AND policyname IN (
      'collections_storefront_view',
      'collections_merchant_view',
      'collections_merchant_modify',
      'collection_access_view',
      'collection_access_modify'
    )
  ) THEN
    RAISE EXCEPTION 'Policies not created properly';
  END IF;
END $$;

COMMIT; 