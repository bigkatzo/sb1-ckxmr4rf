-- Fix type mismatch in get_collection_access_details function
-- Column 8 (owner_email) was causing varchar/text mismatch

DROP FUNCTION IF EXISTS get_collection_access_details(uuid);

CREATE OR REPLACE FUNCTION get_collection_access_details(p_collection_id uuid)
RETURNS TABLE(
  collection_id uuid,
  collection_name text,
  owner_id uuid,
  owner_username text,
  owner_merchant_tier text,
  owner_display_name text,
  owner_profile_image text,
  owner_email text,
  access_users json
) AS $$
DECLARE
  v_collection_info record;
  v_access_users json;
  v_is_admin boolean;
  v_is_owner boolean;
BEGIN
  -- Check if caller is admin
  v_is_admin := (SELECT is_admin());

  -- Get collection and owner info in single query
  SELECT 
    c.id,
    c.name,
    c.user_id,
    COALESCE(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1)) as owner_username,
    COALESCE(up.merchant_tier::text, 'starter_merchant') as owner_merchant_tier,
    COALESCE(up.display_name, '') as owner_display_name,
    COALESCE(up.profile_image, '') as owner_profile_image,
    COALESCE(u.email, '')::text as owner_email  -- Explicit cast to text
  INTO v_collection_info
  FROM collections c
  JOIN auth.users u ON u.id = c.user_id
  LEFT JOIN user_profiles up ON up.id = c.user_id
  WHERE c.id = p_collection_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Collection not found';
  END IF;

  -- Check permissions after getting collection info
  v_is_owner := (v_collection_info.user_id = auth.uid());
  
  IF NOT (v_is_admin OR v_is_owner) THEN
    RAISE EXCEPTION 'Only admins or collection owners can view collection access details';
  END IF;

  -- Get all access users with ORDER BY inside json_agg
  SELECT COALESCE(json_agg(
    json_build_object(
      'user_id', ca.user_id,
      'access_type', ca.access_type,
      'username', COALESCE(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1)),
      'email', COALESCE(u.email, '')::text,  -- Explicit cast to text
      'display_name', COALESCE(up.display_name, ''),
      'profile_image', COALESCE(up.profile_image, ''),
      'role', COALESCE(up.role, 'user'),
      'merchant_tier', COALESCE(up.merchant_tier::text, 'starter_merchant'),
      'created_at', ca.created_at
    ) ORDER BY ca.created_at DESC
  ), '[]'::json)
  INTO v_access_users
  FROM collection_access ca
  JOIN auth.users u ON u.id = ca.user_id
  LEFT JOIN user_profiles up ON up.id = ca.user_id
  WHERE ca.collection_id = p_collection_id;

  RETURN QUERY
  SELECT 
    v_collection_info.id,
    v_collection_info.name,
    v_collection_info.user_id,
    v_collection_info.owner_username,
    v_collection_info.owner_merchant_tier,
    v_collection_info.owner_display_name,
    v_collection_info.owner_profile_image,
    v_collection_info.owner_email,
    v_access_users;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_collection_access_details(uuid) TO authenticated; 