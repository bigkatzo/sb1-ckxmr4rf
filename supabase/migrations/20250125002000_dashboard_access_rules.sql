-- Drop existing policies
DROP POLICY IF EXISTS "collections_policy" ON collections;
DROP POLICY IF EXISTS "collection_access_policy" ON collection_access;

-- Create enum for access types if it doesn't exist
DO $$ BEGIN
    CREATE TYPE access_type AS ENUM ('view', 'edit');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Save existing user_profiles policies that depend on auth.is_admin()
CREATE OR REPLACE FUNCTION recreate_user_profile_policies() 
RETURNS void AS $$
BEGIN
  -- Recreate the policies that were dropped by CASCADE
  DROP POLICY IF EXISTS "admin_manage_profiles" ON user_profiles;
  CREATE POLICY "admin_manage_profiles" ON user_profiles
    USING (auth.is_admin());

  DROP POLICY IF EXISTS "view_own_profile" ON user_profiles;
  CREATE POLICY "view_own_profile" ON user_profiles
    FOR SELECT
    USING (auth.uid() = id OR auth.is_admin());
END;
$$ LANGUAGE plpgsql;

-- Drop existing functions with CASCADE to handle dependencies
DROP FUNCTION IF EXISTS auth.is_admin() CASCADE;
DROP FUNCTION IF EXISTS auth.is_merchant() CASCADE;
DROP FUNCTION IF EXISTS auth.has_collection_access(uuid, access_type) CASCADE;
DROP FUNCTION IF EXISTS grant_collection_access() CASCADE;

-- Create helper functions first
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION auth.is_merchant()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'merchant')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION auth.has_collection_access(collection_id uuid, required_access access_type)
RETURNS boolean AS $$
BEGIN
  -- First check if user is admin
  IF auth.is_admin() THEN
    RETURN true;
  END IF;

  -- Then check regular access
  RETURN EXISTS (
    SELECT 1 FROM collection_access ca
    WHERE ca.collection_id = collection_id
    AND ca.user_id = auth.uid()
    AND CASE
      WHEN required_access = 'view' THEN ca.access_type IN ('view', 'edit')
      WHEN required_access = 'edit' THEN ca.access_type = 'edit'
    END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger function
CREATE OR REPLACE FUNCTION grant_collection_access()
RETURNS TRIGGER AS $$
BEGIN
  -- Always create access entry, even for admins, for tracking purposes
  INSERT INTO collection_access (collection_id, user_id, access_type)
  VALUES (NEW.id, NEW.user_id, 'edit');
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- If entry already exists, update it to edit
    UPDATE collection_access 
    SET access_type = 'edit'
    WHERE collection_id = NEW.id AND user_id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on tables
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_access ENABLE ROW LEVEL SECURITY;

-- Ensure proper table grants
GRANT ALL ON collections TO authenticated;
GRANT ALL ON collection_access TO authenticated;

-- Now create policies after functions exist
CREATE POLICY "collections_view_policy" ON collections
FOR SELECT TO authenticated
USING (
  auth.is_admin() OR auth.has_collection_access(id, 'view'::access_type)
);

CREATE POLICY "collections_edit_policy" ON collections
FOR UPDATE TO authenticated
USING (
  auth.is_admin() OR auth.has_collection_access(id, 'edit'::access_type)
)
WITH CHECK (
  auth.is_admin() OR auth.has_collection_access(id, 'edit'::access_type)
);

CREATE POLICY "collections_delete_policy" ON collections
FOR DELETE TO authenticated
USING (
  auth.is_admin() OR auth.has_collection_access(id, 'edit'::access_type)
);

CREATE POLICY "collections_insert_policy" ON collections
FOR INSERT TO authenticated
WITH CHECK (
  -- Only merchants and admins can create collections
  auth.is_merchant()
);

-- Collection access table policies
CREATE POLICY "collection_access_view_policy" ON collection_access
FOR SELECT TO authenticated
USING (
  auth.is_admin() OR auth.has_collection_access(collection_id, 'view'::access_type)
);

CREATE POLICY "collection_access_edit_policy" ON collection_access
FOR ALL TO authenticated
USING (
  auth.is_admin() OR auth.has_collection_access(collection_id, 'edit'::access_type)
);

-- Create trigger after function exists
DROP TRIGGER IF EXISTS collection_access_trigger ON collections;
CREATE TRIGGER collection_access_trigger
  AFTER INSERT ON collections
  FOR EACH ROW
  EXECUTE FUNCTION grant_collection_access();

-- Grant edit access to all existing collection owners
INSERT INTO collection_access (collection_id, user_id, access_type)
SELECT 
  id as collection_id,
  user_id,
  'edit'::access_type as access_type
FROM collections c
WHERE NOT EXISTS (
  SELECT 1 FROM collection_access ca 
  WHERE ca.collection_id = c.id 
  AND ca.user_id = c.user_id
);

-- Update any existing owner access to edit if it's not already
UPDATE collection_access ca
SET access_type = 'edit'
FROM collections c
WHERE ca.collection_id = c.id
AND ca.user_id = c.user_id
AND ca.access_type != 'edit';

-- Add test function to verify access is granted
CREATE OR REPLACE FUNCTION test_collection_creation() 
RETURNS text AS $$
DECLARE
  v_collection_id uuid;
  v_user_id uuid;
  v_access_type access_type;
BEGIN
  -- Get the current user id
  v_user_id := auth.uid();
  
  -- Create a test collection
  INSERT INTO collections (
    id,
    name,
    description,
    launch_date,
    visible,
    user_id
  ) VALUES (
    gen_random_uuid(),
    'Test Collection',
    'Test Description',
    now(),
    true,
    v_user_id
  ) RETURNING id INTO v_collection_id;
  
  -- Check if access was granted
  SELECT access_type INTO v_access_type
  FROM collection_access
  WHERE collection_id = v_collection_id
  AND user_id = v_user_id;
  
  IF v_access_type = 'edit' THEN
    RETURN 'SUCCESS: Edit access was granted';
  ELSE
    RETURN 'FAILURE: Edit access was not granted properly';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate user_profiles policies using DO block
DO $$ 
BEGIN
  -- Drop existing policies first
  DROP POLICY IF EXISTS "admin_manage_profiles" ON user_profiles;
  DROP POLICY IF EXISTS "view_own_profile" ON user_profiles;
  
  -- Create new policies
  CREATE POLICY "admin_manage_profiles" ON user_profiles
    USING (auth.is_admin());
    
  CREATE POLICY "view_own_profile" ON user_profiles
    FOR SELECT
    USING (auth.uid() = id OR auth.is_admin());
END $$;

-- Drop the temporary function as it's no longer needed
DROP FUNCTION IF EXISTS recreate_user_profile_policies();

-- Add function comments
COMMENT ON FUNCTION auth.is_admin() IS 'Checks if the current user has admin role';
COMMENT ON FUNCTION auth.is_merchant() IS 'Checks if the current user has merchant or admin role';
COMMENT ON FUNCTION auth.has_collection_access(uuid, access_type) IS 'Checks if the current user has specified access level to a collection';
COMMENT ON FUNCTION grant_collection_access() IS 'Automatically grants edit access to collection creator';
COMMENT ON FUNCTION test_collection_creation() IS 'Test function to verify automatic access granting on collection creation'; 