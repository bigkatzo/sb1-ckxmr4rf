-- Drop existing collection_access table and related objects
DROP TABLE IF EXISTS collection_access CASCADE;

-- Create collection_access table
CREATE TABLE collection_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  collection_id uuid REFERENCES collections(id) ON DELETE CASCADE,
  access_type text NOT NULL CHECK (access_type IN ('view', 'manage')),
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, collection_id)
);

-- Enable RLS
ALTER TABLE collection_access ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "collection_access_select"
  ON collection_access FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR auth.is_admin()
    OR EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "collection_access_all"
  ON collection_access FOR ALL
  TO authenticated
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin());

-- Create function to grant collection access
CREATE OR REPLACE FUNCTION grant_collection_access(
  p_user_id uuid,
  p_collection_id uuid,
  p_access_type text
)
RETURNS void AS $$
BEGIN
  -- Verify caller is admin
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin can grant collection access';
  END IF;

  -- Validate access type
  IF p_access_type NOT IN ('view', 'manage') THEN
    RAISE EXCEPTION 'Invalid access type. Must be view or manage';
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

-- Create function to revoke collection access
CREATE OR REPLACE FUNCTION revoke_collection_access(
  p_user_id uuid,
  p_collection_id uuid
)
RETURNS void AS $$
BEGIN
  -- Verify caller is admin
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin can revoke collection access';
  END IF;

  -- Delete access
  DELETE FROM collection_access
  WHERE user_id = p_user_id
  AND collection_id = p_collection_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user's collection access
CREATE OR REPLACE FUNCTION get_user_collection_access(p_user_id uuid)
RETURNS TABLE (
  collection_id uuid,
  collection_name text,
  access_type text
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
    ca.access_type
  FROM collection_access ca
  JOIN collections c ON c.id = ca.collection_id
  WHERE ca.user_id = p_user_id
  ORDER BY c.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT ALL ON collection_access TO authenticated;
GRANT EXECUTE ON FUNCTION grant_collection_access(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_collection_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_collection_access(uuid) TO authenticated;