-- Drop any existing admin-related functions
DROP FUNCTION IF EXISTS auth.is_admin() CASCADE;

-- Create admin check function that only recognizes admin420
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (
    SELECT email = 'admin420@merchant.local'
    FROM auth.users
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS policies to give admin420 full access to collections
DROP POLICY IF EXISTS "Collection view policy" ON collections;
DROP POLICY IF EXISTS "Collection manage policy" ON collections;

-- Create new collection policies that prioritize admin access
CREATE POLICY "Collection view policy"
  ON collections FOR SELECT
  USING (
    visible = true 
    OR auth.is_admin() 
    OR user_id = auth.uid()
  );

CREATE POLICY "Collection manage policy"
  ON collections FOR ALL
  TO authenticated
  USING (
    auth.is_admin() 
    OR user_id = auth.uid()
  )
  WITH CHECK (
    auth.is_admin() 
    OR user_id = auth.uid()
  );

-- Create helper function to check collection access
CREATE OR REPLACE FUNCTION auth.has_collection_access(collection_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN (
    auth.is_admin()
    OR EXISTS (
      SELECT 1 FROM collections
      WHERE id = collection_id
      AND user_id = auth.uid()
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;