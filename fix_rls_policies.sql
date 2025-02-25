-- Start transaction
BEGIN;

-- Drop existing policies
DROP POLICY IF EXISTS "collections_view" ON collections;
DROP POLICY IF EXISTS "collections_merchant_view" ON collections;
DROP POLICY IF EXISTS "collections_storefront_view" ON collections;
DROP POLICY IF EXISTS "collections_merchant_modify" ON collections;
DROP POLICY IF EXISTS "collections_admin_all_policy" ON collections;

-- Create storefront policy for public access
CREATE POLICY "collections_storefront_view"
ON collections
FOR SELECT
TO public
USING (
  -- Only public collections are visible in the storefront
  visible = true
);

-- Create dashboard policies for authenticated users
CREATE POLICY "collections_dashboard_view"
ON collections
FOR SELECT
TO authenticated
USING (
  -- Users can view their own collections
  user_id = auth.uid()
  OR
  -- Admins can view all collections
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
  OR
  -- Users with explicit access can view collections
  EXISTS (
    SELECT 1 FROM collection_access
    WHERE collection_id = id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "collections_dashboard_modify"
ON collections
FOR ALL
TO authenticated
USING (
  -- Users can modify their own collections
  user_id = auth.uid()
  OR
  -- Admins can modify all collections
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
  OR
  -- Users with edit access can modify collections
  EXISTS (
    SELECT 1 FROM collection_access
    WHERE collection_id = id
    AND user_id = auth.uid()
    AND access_type = 'edit'
  )
);

-- Drop existing policies for collection_access
DROP POLICY IF EXISTS "collection_access_view" ON collection_access;
DROP POLICY IF EXISTS "collection_access_modify" ON collection_access;

-- Create simplified policies for collection_access
CREATE POLICY "collection_access_view"
ON collection_access
FOR SELECT
TO authenticated
USING (
  -- Users can see their own access records
  user_id = auth.uid()
  OR
  -- Collection owners can see access records for their collections
  EXISTS (
    SELECT 1 FROM collections
    WHERE id = collection_id
    AND user_id = auth.uid()
  )
  OR
  -- Admins can see all access records
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

CREATE POLICY "collection_access_modify"
ON collection_access
FOR ALL
TO authenticated
USING (
  -- Collection owners can modify access
  EXISTS (
    SELECT 1 FROM collections
    WHERE id = collection_id
    AND user_id = auth.uid()
  )
  OR
  -- Admins can modify all access records
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

COMMIT; 