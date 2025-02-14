-- Drop existing functions first
DO $$ BEGIN
  DROP FUNCTION IF EXISTS grant_collection_access(uuid, uuid, text) CASCADE;
  DROP FUNCTION IF EXISTS grant_collection_access(text, uuid, uuid) CASCADE;
  DROP FUNCTION IF EXISTS revoke_collection_access(uuid, uuid) CASCADE;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create function to grant collection access
CREATE OR REPLACE FUNCTION grant_collection_access(
  p_user_id uuid,
  p_collection_id uuid,
  p_access_type text
)
RETURNS void AS $$
DECLARE
  v_user_exists boolean;
  v_collection_exists boolean;
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

  -- Check if user exists
  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE id = p_user_id
  ) INTO v_user_exists;

  IF NOT v_user_exists THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Check if collection exists
  SELECT EXISTS (
    SELECT 1 FROM collections WHERE id = p_collection_id
  ) INTO v_collection_exists;

  IF NOT v_collection_exists THEN
    RAISE EXCEPTION 'Collection not found';
  END IF;

  -- Don't allow granting access to collection owner
  IF EXISTS (
    SELECT 1 FROM collections
    WHERE id = p_collection_id
    AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Cannot grant access to collection owner';
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

-- Create function to revoke collection access
CREATE OR REPLACE FUNCTION revoke_collection_access(
  p_user_id uuid,
  p_collection_id uuid
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

  -- Don't allow revoking access from collection owner
  IF EXISTS (
    SELECT 1 FROM collections
    WHERE id = p_collection_id
    AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Cannot revoke access from collection owner';
  END IF;

  -- Revoke access
  DELETE FROM collection_access
  WHERE collection_id = p_collection_id
  AND user_id = p_user_id;
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
    -- Collection owners can view access to their collections
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_id
      AND c.user_id = auth.uid()
    )
    OR
    -- Admin can view all
    auth.is_admin()
  )
  WITH CHECK (
    -- Only collection owners and admin can modify
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_id
      AND (
        c.user_id = auth.uid()
        OR auth.is_admin()
      )
    )
  );

-- Grant necessary permissions
GRANT ALL ON collection_access TO authenticated;
GRANT EXECUTE ON FUNCTION grant_collection_access(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_collection_access(uuid, uuid) TO authenticated;