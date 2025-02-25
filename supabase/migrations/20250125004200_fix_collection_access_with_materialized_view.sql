-- Start transaction
BEGIN;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own collection access" ON collection_access;
DROP POLICY IF EXISTS "Collection owners can manage access" ON collection_access;
DROP POLICY IF EXISTS "Admins can manage all access" ON collection_access;
DROP POLICY IF EXISTS "Collection access view policy" ON collection_access;
DROP POLICY IF EXISTS "Collection access insert policy" ON collection_access;
DROP POLICY IF EXISTS "Collection access update policy" ON collection_access;
DROP POLICY IF EXISTS "Collection access delete policy" ON collection_access;

-- Create materialized view for collection ownership
DROP MATERIALIZED VIEW IF EXISTS collection_ownership;
CREATE MATERIALIZED VIEW collection_ownership AS
SELECT 
    c.id as collection_id,
    c.user_id as owner_id,
    up.role as owner_role
FROM collections c
LEFT JOIN user_profiles up ON up.id = c.user_id;

-- Create index for better performance
CREATE UNIQUE INDEX collection_ownership_idx ON collection_ownership(collection_id);
CREATE INDEX collection_ownership_owner_idx ON collection_ownership(owner_id);

-- Create function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_collection_ownership()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW collection_ownership;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to keep the materialized view up to date
DROP TRIGGER IF EXISTS refresh_collection_ownership_trigger ON collections;
CREATE TRIGGER refresh_collection_ownership_trigger
AFTER INSERT OR UPDATE OR DELETE ON collections
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_collection_ownership();

DROP TRIGGER IF EXISTS refresh_collection_ownership_profile_trigger ON user_profiles;
CREATE TRIGGER refresh_collection_ownership_profile_trigger
AFTER UPDATE OF role ON user_profiles
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_collection_ownership();

-- Enable RLS
ALTER TABLE collection_access ENABLE ROW LEVEL SECURITY;

-- Create simplified policies using the materialized view
CREATE POLICY "Collection access view policy"
ON collection_access
FOR SELECT
TO authenticated
USING (
  -- User can view their own access records
  user_id = auth.uid()
  OR
  -- Collection owners can view all access records for their collections
  EXISTS (
    SELECT 1 FROM collection_ownership
    WHERE collection_id = collection_access.collection_id
    AND (owner_id = auth.uid() OR owner_role = 'admin')
  )
);

CREATE POLICY "Collection access modify policy"
ON collection_access
FOR ALL
TO authenticated
USING (
  -- Collection owners and admins can modify access records
  EXISTS (
    SELECT 1 FROM collection_ownership
    WHERE collection_id = collection_access.collection_id
    AND (owner_id = auth.uid() OR owner_role = 'admin')
  )
);

-- Do initial refresh of the materialized view
REFRESH MATERIALIZED VIEW collection_ownership;

-- Verify policies were created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'collection_access' 
    AND policyname IN (
      'Collection access view policy',
      'Collection access modify policy'
    )
  ) THEN
    RAISE EXCEPTION 'Policy creation failed';
  END IF;
END $$;

COMMIT; 