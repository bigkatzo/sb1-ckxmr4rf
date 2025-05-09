-- Fix the list_users function to resolve ambiguous id column reference
DROP FUNCTION IF EXISTS list_users() CASCADE;

-- Recreate the function with qualified column references
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
    u.id,  -- Qualified id column from auth.users
    COALESCE(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1))::text as username,
    u.email::text,
    COALESCE(p.role, 'user')::text as role,
    u.created_at,
    COUNT(DISTINCT c.id) as collections_count,
    COUNT(DISTINCT ca.collection_id) as access_count
  FROM auth.users u
  LEFT JOIN user_profiles p ON p.id = u.id
  LEFT JOIN collections c ON c.user_id = u.id
  LEFT JOIN collection_access ca ON ca.user_id = u.id
  WHERE u.email != 'admin420@merchant.local'  -- Exclude admin420
  GROUP BY u.id, u.email, p.role  -- Qualified id column
  ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION list_users() TO authenticated;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

-- Verify function exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_proc 
    WHERE proname = 'list_users' 
    AND pronamespace = 'public'::regnamespace
  ) THEN
    RAISE EXCEPTION 'Function public.list_users was not created properly';
  END IF;
END $$; 