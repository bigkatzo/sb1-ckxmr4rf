-- Drop existing functions first
DO $$ BEGIN
  DROP FUNCTION IF EXISTS grant_collection_access(uuid, uuid, text) CASCADE;
  DROP FUNCTION IF EXISTS grant_collection_access(text, uuid, uuid) CASCADE;
  DROP FUNCTION IF EXISTS revoke_collection_access(uuid, uuid) CASCADE;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create function to grant collection access with named parameters
CREATE OR REPLACE FUNCTION grant_collection_access(
  p_access_type text,
  p_collection_id uuid,
  p_user_id uuid
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
    RAISE EXCEPTION 'Only admin or collection owner can grant access';
  END IF;

  -- Validate access type
  IF p_access_type NOT IN ('view', 'manage') THEN
    RAISE EXCEPTION 'Invalid access type. Must be view or manage';
  END IF;

  -- Grant access
  INSERT INTO collection_access (
    collection_id,
    user_id,
    access_type,
    granted_by
  )
  VALUES (
    p_collection_id,
    p_user_id,
    p_access_type,
    auth.uid()
  )
  ON CONFLICT (collection_id, user_id) 
  DO UPDATE SET 
    access_type = EXCLUDED.access_type,
    granted_by = EXCLUDED.granted_by;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to revoke collection access with named parameters
CREATE OR REPLACE FUNCTION revoke_collection_access(
  p_collection_id uuid,
  p_user_id uuid
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
    RAISE EXCEPTION 'Only admin or collection owner can revoke access';
  END IF;

  -- Revoke access
  DELETE FROM collection_access
  WHERE collection_id = p_collection_id
  AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION grant_collection_access(text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_collection_access(uuid, uuid) TO authenticated;