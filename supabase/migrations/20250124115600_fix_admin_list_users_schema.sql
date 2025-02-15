-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.admin_list_users(text, text, int, int) CASCADE;

-- Create admin_list_users function in public schema
CREATE OR REPLACE FUNCTION public.admin_list_users(
  p_search text DEFAULT NULL,
  p_role text DEFAULT NULL,
  p_limit int DEFAULT 10,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  email text,
  role text,
  created_at timestamptz,
  collection_count bigint,
  last_active timestamptz,
  metadata jsonb
) AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  -- Check admin status with error handling
  BEGIN
    v_is_admin := auth.is_admin();
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Error checking admin status: %', SQLERRM;
  END;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Only admin users can list users';
  END IF;

  -- Return users with error handling
  BEGIN
    RETURN QUERY
    SELECT 
      u.id,
      u.email,
      COALESCE(p.role, 'user')::text as role,
      u.created_at,
      COALESCE(uc.collection_count, 0)::bigint,
      u.last_sign_in_at,
      u.raw_app_meta_data
    FROM auth.users u
    LEFT JOIN user_profiles p ON p.id = u.id
    LEFT JOIN (
      SELECT 
        user_id,
        COUNT(*) as collection_count
      FROM collections
      GROUP BY user_id
    ) uc ON uc.user_id = u.id
    WHERE 
      (p_search IS NULL OR u.email ILIKE '%' || p_search || '%')
      AND (p_role IS NULL OR p.role = p_role)
    ORDER BY u.created_at DESC
    LIMIT LEAST(p_limit, 100)
    OFFSET p_offset;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Error fetching users: %', SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.admin_list_users(text, text, int, int) TO authenticated;

-- Notify about function creation
DO $$
BEGIN
  RAISE NOTICE 'Successfully created public.admin_list_users function';
END $$; 