-- Drop existing functions first
DO $$ BEGIN
  DROP FUNCTION IF EXISTS manage_collection_access(uuid, uuid, text) CASCADE;
  DROP FUNCTION IF EXISTS get_user_collection_access(uuid) CASCADE;
  DROP FUNCTION IF EXISTS auth.get_collection_access(uuid) CASCADE;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create function to check collection access level
CREATE OR REPLACE FUNCTION auth.get_collection_access(collection_id uuid)
RETURNS text AS $$
BEGIN
  -- Admin has full access
  IF auth.is_admin() THEN
    RETURN 'manage';
  END IF;

  -- Check if user owns collection
  IF EXISTS (
    SELECT 1 FROM collections
    WHERE id = collection_id
    AND user_id = auth.uid()
  ) THEN
    RETURN 'manage';
  END IF;

  -- Check explicit collection access
  RETURN COALESCE(
    (
      SELECT access_type 
      FROM collection_access
      WHERE collection_id = collection_id
      AND user_id = auth.uid()
      AND access_type IN ('view', 'manage')
    ),
    'none'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to manage collection access
CREATE OR REPLACE FUNCTION manage_collection_access(
  p_user_id uuid,
  p_collection_id uuid,
  p_access_type text
)
RETURNS void AS $$
BEGIN
  -- Verify caller is admin or collection owner
  IF NOT (
    auth.is_admin() OR 
    EXISTS (
      SELECT 1 FROM collections 
      WHERE id = p_collection_id 
      AND user_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to manage collection access';
  END IF;

  -- Validate access type
  IF p_access_type NOT IN ('none', 'view', 'manage') THEN
    RAISE EXCEPTION 'Invalid access type. Must be none, view, or manage';
  END IF;

  -- Don't allow modifying admin's access
  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = p_user_id
    AND email = 'admin420@merchant.local'
  ) THEN
    RAISE EXCEPTION 'Cannot modify admin user access';
  END IF;

  -- Remove access if none
  IF p_access_type = 'none' THEN
    DELETE FROM collection_access
    WHERE user_id = p_user_id
    AND collection_id = p_collection_id;
    RETURN;
  END IF;

  -- Insert or update access
  INSERT INTO collection_access (
    user_id,
    collection_id,
    access_type,
    granted_by
  )
  VALUES (
    p_user_id,
    p_collection_id,
    p_access_type,
    auth.uid()
  )
  ON CONFLICT (user_id, collection_id) 
  DO UPDATE SET 
    access_type = EXCLUDED.access_type,
    granted_by = EXCLUDED.granted_by;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user's collection access
CREATE OR REPLACE FUNCTION get_user_collection_access(p_user_id uuid)
RETURNS TABLE (
  collection_id uuid,
  collection_name text,
  access_type text,
  granted_by_username text,
  granted_at timestamptz
) AS $$
BEGIN
  -- Verify caller is admin or user themselves
  IF NOT (auth.is_admin() OR auth.uid() = p_user_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    ca.collection_id,
    c.name as collection_name,
    ca.access_type,
    (SELECT raw_user_meta_data->>'username' FROM auth.users WHERE id = ca.granted_by) as granted_by_username,
    ca.created_at as granted_at
  FROM collection_access ca
  JOIN collections c ON c.id = ca.collection_id
  WHERE ca.user_id = p_user_id
  AND ca.access_type IN ('view', 'manage')
  ORDER BY c.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RLS policies for collection_access
DROP POLICY IF EXISTS "collection_access_policy" ON collection_access;
CREATE POLICY "collection_access_policy"
  ON collection_access
  FOR ALL
  TO authenticated
  USING (
    -- Users can view their own access
    user_id = auth.uid()
    OR
    -- Admins can view all access
    auth.is_admin()
    OR
    -- Collection owners can view access to their collections
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_id
      AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Only admins and collection owners can modify access
    auth.is_admin()
    OR
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_id
      AND c.user_id = auth.uid()
    )
  );

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.get_collection_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION manage_collection_access(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_collection_access(uuid) TO authenticated;
GRANT ALL ON collection_access TO authenticated;