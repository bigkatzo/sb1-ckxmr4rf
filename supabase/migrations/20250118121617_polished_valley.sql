-- Drop existing list_users function
DROP FUNCTION IF EXISTS list_users();

-- Create updated list_users function that includes admin420
CREATE OR REPLACE FUNCTION list_users()
RETURNS TABLE (
  id uuid,
  username text,
  email text,
  role text,
  created_at timestamptz,
  collections_count bigint,
  access_count bigint
) AS $$
BEGIN
  -- Verify caller is admin
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin can list users';
  END IF;

  RETURN QUERY
  SELECT 
    u.id,
    u.raw_user_meta_data->>'username' as username,
    u.email,
    COALESCE(p.role, 'user') as role,
    u.created_at,
    COUNT(DISTINCT c.id) as collections_count,
    COUNT(DISTINCT ca.collection_id) as access_count
  FROM auth.users u
  LEFT JOIN user_profiles p ON p.id = u.id
  LEFT JOIN collections c ON c.user_id = u.id
  LEFT JOIN collection_access ca ON ca.user_id = u.id
  GROUP BY u.id, u.email, p.role
  ORDER BY 
    -- Admin420 first, then sort by creation date
    CASE WHEN u.email = 'admin420@merchant.local' THEN 0 ELSE 1 END,
    u.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION list_users() TO authenticated;