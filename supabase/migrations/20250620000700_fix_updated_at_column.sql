-- Fix multiple issues: GROUP BY, merchant_tier casting, and updated_at column
BEGIN;

-- First fix the get_collection_access_details function
DROP FUNCTION IF EXISTS get_collection_access_details(uuid);

CREATE OR REPLACE FUNCTION get_collection_access_details(p_collection_id uuid)
RETURNS TABLE (
  collection_id uuid,
  collection_name text,
  owner_id uuid,
  owner_username text,
  owner_merchant_tier text,
  owner_display_name text,
  owner_profile_image text,
  access_users json
) AS $$
DECLARE
  v_collection_info record;
  v_access_users json;
BEGIN
  -- Check if caller is admin
  IF NOT (SELECT is_admin()) THEN
    RAISE EXCEPTION 'Only admins can view collection access details';
  END IF;

  -- Get collection and owner info
  SELECT 
    c.id,
    c.name,
    c.user_id,
    COALESCE(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1)) as owner_username,
    COALESCE(up.merchant_tier::text, 'starter_merchant') as owner_merchant_tier,
    COALESCE(up.display_name, '') as owner_display_name,
    COALESCE(up.profile_image, '') as owner_profile_image
  INTO v_collection_info
  FROM collections c
  JOIN auth.users u ON u.id = c.user_id
  LEFT JOIN user_profiles up ON up.id = c.user_id
  WHERE c.id = p_collection_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Collection not found';
  END IF;

  -- Get all access users with proper aggregation
  WITH access_data AS (
    SELECT 
      ca.user_id,
      ca.access_type,
      COALESCE(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1)) as username,
      u.email,
      COALESCE(up.display_name, '') as display_name,
      COALESCE(up.profile_image, '') as profile_image,
      COALESCE(up.role, 'user') as role,
      COALESCE(up.merchant_tier::text, 'starter_merchant') as merchant_tier,
      ca.created_at
    FROM collection_access ca
    JOIN auth.users u ON u.id = ca.user_id
    LEFT JOIN user_profiles up ON up.id = ca.user_id
    WHERE ca.collection_id = p_collection_id
    ORDER BY ca.created_at DESC
  )
  SELECT COALESCE(json_agg(
    json_build_object(
      'user_id', ad.user_id,
      'access_type', ad.access_type,
      'username', ad.username,
      'email', ad.email,
      'display_name', ad.display_name,
      'profile_image', ad.profile_image,
      'role', ad.role,
      'merchant_tier', ad.merchant_tier,
      'created_at', ad.created_at
    )
  ), '[]'::json)
  INTO v_access_users
  FROM access_data ad;

  RETURN QUERY
  SELECT 
    v_collection_info.id,
    v_collection_info.name,
    v_collection_info.user_id,
    v_collection_info.owner_username,
    v_collection_info.owner_merchant_tier,
    v_collection_info.owner_display_name,
    v_collection_info.owner_profile_image,
    v_access_users;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Now fix the manage_collection_access function without the updated_at reference
DROP FUNCTION IF EXISTS manage_collection_access(uuid, uuid, text, text);

CREATE OR REPLACE FUNCTION manage_collection_access(
  p_collection_id uuid,
  p_target_user_id uuid,
  p_action text, -- 'add', 'update', 'remove', 'transfer_ownership'
  p_access_type text DEFAULT NULL -- 'view', 'edit', 'owner'
)
RETURNS json AS $$
DECLARE
  v_collection_info record;
  v_target_user_info record;
  v_old_owner_id uuid;
  v_result json;
BEGIN
  -- Check if caller is admin
  IF NOT (SELECT is_admin()) THEN
    RAISE EXCEPTION 'Only admins can manage collection access';
  END IF;

  -- Validate action
  IF p_action NOT IN ('add', 'update', 'remove', 'transfer_ownership') THEN
    RAISE EXCEPTION 'Invalid action. Must be add, update, remove, or transfer_ownership';
  END IF;

  -- Get collection info
  SELECT id, name, user_id
  INTO v_collection_info
  FROM collections 
  WHERE id = p_collection_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Collection not found';
  END IF;

  -- Get target user info and validate business rules
  SELECT 
    u.id,
    u.email,
    COALESCE(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1)) as username,
    COALESCE(up.role, 'user') as role,
    COALESCE(up.display_name, '') as display_name
  INTO v_target_user_info
  FROM auth.users u
  LEFT JOIN user_profiles up ON up.id = u.id
  WHERE u.id = p_target_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;

  -- Business rule validation for access types
  IF p_action IN ('add', 'update', 'transfer_ownership') THEN
    IF p_access_type IS NULL THEN
      RAISE EXCEPTION 'Access type is required for action: %', p_action;
    END IF;

    -- Users can only get view/edit
    IF v_target_user_info.role = 'user' AND p_access_type NOT IN ('view', 'edit') THEN
      RAISE EXCEPTION 'Users can only receive view or edit access';
    END IF;

    -- Merchants and admins can get view/edit/owner
    IF v_target_user_info.role IN ('merchant', 'admin') AND p_access_type NOT IN ('view', 'edit', 'owner') THEN
      RAISE EXCEPTION 'Invalid access type: %', p_access_type;
    END IF;
  END IF;

  -- Handle different actions
  CASE p_action
    WHEN 'remove' THEN
      -- Remove access
      DELETE FROM collection_access 
      WHERE collection_id = p_collection_id AND user_id = p_target_user_id;

      v_result := json_build_object(
        'action', 'removed',
        'user_username', v_target_user_info.username,
        'collection_name', v_collection_info.name
      );

    WHEN 'add', 'update' THEN
      -- Add or update access (removed updated_at reference)
      INSERT INTO collection_access (collection_id, user_id, access_type)
      VALUES (p_collection_id, p_target_user_id, p_access_type)
      ON CONFLICT (collection_id, user_id) 
      DO UPDATE SET 
        access_type = EXCLUDED.access_type;

      v_result := json_build_object(
        'action', p_action,
        'access_type', p_access_type,
        'user_username', v_target_user_info.username,
        'collection_name', v_collection_info.name
      );

    WHEN 'transfer_ownership' THEN
      -- Transfer ownership
      IF p_access_type != 'owner' THEN
        RAISE EXCEPTION 'Transfer ownership requires access_type to be owner';
      END IF;

      IF v_target_user_info.role NOT IN ('merchant', 'admin') THEN
        RAISE EXCEPTION 'User must have merchant role or higher to own collections';
      END IF;

      IF v_collection_info.user_id = p_target_user_id THEN
        RAISE EXCEPTION 'User is already the owner of this collection';
      END IF;

      -- Store old owner
      v_old_owner_id := v_collection_info.user_id;

      -- Transfer ownership
      UPDATE collections 
      SET user_id = p_target_user_id
      WHERE id = p_collection_id;

      -- Remove old owner from collection_access if they exist there
      DELETE FROM collection_access 
      WHERE collection_id = p_collection_id AND user_id = v_old_owner_id;

      -- Give previous owner edit access
      INSERT INTO collection_access (collection_id, user_id, access_type)
      VALUES (p_collection_id, v_old_owner_id, 'edit');

      v_result := json_build_object(
        'action', 'ownership_transferred',
        'new_owner_username', v_target_user_info.username,
        'old_owner_id', v_old_owner_id,
        'collection_name', v_collection_info.name,
        'preserved_access', true
      );
  END CASE;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_collection_access_details(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION manage_collection_access(uuid, uuid, text, text) TO authenticated;

COMMIT; 