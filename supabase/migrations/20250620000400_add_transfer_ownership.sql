-- Add transfer ownership functionality
BEGIN;

-- Create function to transfer collection ownership
CREATE OR REPLACE FUNCTION transfer_collection_ownership(
  p_collection_id uuid,
  p_new_owner_id uuid,
  p_preserve_old_owner_access boolean DEFAULT true
)
RETURNS json AS $$
DECLARE
  v_old_owner_id uuid;
  v_collection_name text;
  v_new_owner_role text;
  v_new_owner_username text;
  v_old_owner_username text;
  v_result json;
BEGIN
  -- Check if caller is admin
  IF NOT (SELECT is_admin()) THEN
    RAISE EXCEPTION 'Only admins can transfer collection ownership';
  END IF;

  -- Get current collection info
  SELECT user_id, name INTO v_old_owner_id, v_collection_name
  FROM collections 
  WHERE id = p_collection_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Collection not found';
  END IF;

  -- Check if new owner is different from current owner
  IF v_old_owner_id = p_new_owner_id THEN
    RAISE EXCEPTION 'User is already the owner of this collection';
  END IF;

  -- Get new owner's role and username
  SELECT 
    COALESCE(up.role, 'user') as role,
    COALESCE(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1)) as username
  INTO v_new_owner_role, v_new_owner_username
  FROM auth.users u
  LEFT JOIN user_profiles up ON up.id = u.id
  WHERE u.id = p_new_owner_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'New owner user not found';
  END IF;

  -- Validate new owner has merchant role or higher
  IF v_new_owner_role NOT IN ('merchant', 'admin') THEN
    RAISE EXCEPTION 'User must have merchant role or higher to own collections';
  END IF;

  -- Get old owner's username for response
  SELECT 
    COALESCE(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1))
  INTO v_old_owner_username
  FROM auth.users u
  WHERE u.id = v_old_owner_id;

  -- Transfer ownership (atomic operation)
  UPDATE collections 
  SET user_id = p_new_owner_id
  WHERE id = p_collection_id;

  -- Remove old owner from collection_access if they exist there
  DELETE FROM collection_access 
  WHERE collection_id = p_collection_id AND user_id = v_old_owner_id;

  -- Give previous owner edit access if requested
  IF p_preserve_old_owner_access THEN
    INSERT INTO collection_access (collection_id, user_id, access_type)
    VALUES (p_collection_id, v_old_owner_id, 'edit')
    ON CONFLICT (collection_id, user_id) 
    DO UPDATE SET access_type = 'edit';
  END IF;

  -- Return success response with details
  v_result := json_build_object(
    'success', true,
    'collection_id', p_collection_id,
    'collection_name', v_collection_name,
    'old_owner_id', v_old_owner_id,
    'old_owner_username', v_old_owner_username,
    'new_owner_id', p_new_owner_id,
    'new_owner_username', v_new_owner_username,
    'preserved_access', p_preserve_old_owner_access
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (admin check is inside function)
GRANT EXECUTE ON FUNCTION transfer_collection_ownership(uuid, uuid, boolean) TO authenticated;

-- Create function to search users for ownership transfer
CREATE OR REPLACE FUNCTION search_users_for_transfer(
  p_search_query text DEFAULT '',
  p_exclude_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  username text,
  email text,
  role text,
  merchant_tier text,
  display_name text
) AS $$
BEGIN
  -- Check if caller is admin
  IF NOT (SELECT is_admin()) THEN
    RAISE EXCEPTION 'Only admins can search users for transfer';
  END IF;

  RETURN QUERY
  SELECT 
    u.id,
    COALESCE(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1)) as username,
    u.email::text,
    COALESCE(up.role, 'user')::text as role,
    COALESCE(up.merchant_tier, 'starter_merchant')::text as merchant_tier,
    COALESCE(up.display_name, '')::text as display_name
  FROM auth.users u
  LEFT JOIN user_profiles up ON up.id = u.id
  WHERE 
    -- Only include merchants and admins
    COALESCE(up.role, 'user') IN ('merchant', 'admin')
    -- Exclude specified user (current owner)
    AND (p_exclude_user_id IS NULL OR u.id != p_exclude_user_id)
    -- Search filter
    AND (
      p_search_query = '' OR
      LOWER(u.email) LIKE LOWER('%' || p_search_query || '%') OR
      LOWER(COALESCE(u.raw_user_meta_data->>'username', '')) LIKE LOWER('%' || p_search_query || '%') OR
      LOWER(COALESCE(up.display_name, '')) LIKE LOWER('%' || p_search_query || '%')
    )
  ORDER BY 
    -- Prioritize users with display names
    CASE WHEN up.display_name IS NOT NULL AND up.display_name != '' THEN 0 ELSE 1 END,
    -- Then by username/email
    COALESCE(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1))
  LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION search_users_for_transfer(text, uuid) TO authenticated;

COMMIT; 