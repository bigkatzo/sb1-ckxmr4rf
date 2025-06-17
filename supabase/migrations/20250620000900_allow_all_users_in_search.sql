-- Update search function to include all users, not just merchants
-- Since we now have proper role-based access control, we can safely include all users
-- The frontend will limit access types based on user roles

BEGIN;

-- Drop and recreate the search function to include all users
DROP FUNCTION IF EXISTS search_users_for_transfer(text, uuid);

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
  display_name text,
  profile_image text
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
    COALESCE(up.display_name, '')::text as display_name,
    COALESCE(up.profile_image, '')::text as profile_image
  FROM auth.users u
  LEFT JOIN user_profiles up ON up.id = u.id
  WHERE 
    -- Include ALL users (removed role restriction)
    u.id IS NOT NULL
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
    -- Prioritize by role (admins, merchants, then users)
    CASE 
      WHEN COALESCE(up.role, 'user') = 'admin' THEN 0
      WHEN COALESCE(up.role, 'user') = 'merchant' THEN 1
      ELSE 2
    END,
    -- Then prioritize users with display names
    CASE WHEN up.display_name IS NOT NULL AND up.display_name != '' THEN 0 ELSE 1 END,
    -- Then by username/email
    COALESCE(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1))
  LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION search_users_for_transfer(text, uuid) TO authenticated;

COMMIT; 