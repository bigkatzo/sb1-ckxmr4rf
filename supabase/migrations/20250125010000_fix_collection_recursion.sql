-- Start transaction
BEGIN;

-- Drop existing problematic policies and functions
DROP POLICY IF EXISTS "collections_policy" ON collections;
DROP POLICY IF EXISTS "collections_view" ON collections;
DROP POLICY IF EXISTS "collections_merchant_view" ON collections;
DROP POLICY IF EXISTS "collections_storefront_view" ON collections;
DROP FUNCTION IF EXISTS auth.has_collection_access(uuid) CASCADE;
DROP FUNCTION IF EXISTS auth.can_access_collection(uuid) CASCADE;
DROP FUNCTION IF EXISTS auth.get_collection_access(uuid) CASCADE;

-- Create simplified collection access function
CREATE OR REPLACE FUNCTION auth.has_collection_access(p_collection_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM collections c
    LEFT JOIN collection_access ca ON ca.collection_id = c.id AND ca.user_id = auth.uid()
    LEFT JOIN user_profiles up ON up.id = auth.uid()
    WHERE c.id = p_collection_id
    AND (
      c.visible = true
      OR c.user_id = auth.uid()
      OR ca.user_id IS NOT NULL
      OR up.role = 'admin'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create simplified collection policies
CREATE POLICY "collections_policy" ON collections
FOR ALL USING (
  visible = true  -- Public access for visible collections
  OR user_id = auth.uid()  -- Owner access
  OR EXISTS (  -- Direct access check without recursive functions
    SELECT 1 FROM collection_access ca
    WHERE ca.collection_id = id
    AND ca.user_id = auth.uid()
  )
  OR EXISTS (  -- Admin check
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'admin'
  )
);

-- Verify changes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'collections'
    AND policyname = 'collections_policy'
  ) THEN
    RAISE EXCEPTION 'Policy not created properly';
  END IF;
END $$;

COMMIT; 