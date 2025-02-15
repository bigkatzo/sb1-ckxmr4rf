-- Set the search path to include necessary schemas
SET search_path TO public, auth;

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.admin_list_users(text, text, int, int) CASCADE;

-- Create admin_list_users function in public schema with explicit parameter names
CREATE OR REPLACE FUNCTION public.admin_list_users(
  p_search text DEFAULT NULL,
  p_role text DEFAULT NULL,
  p_limit integer DEFAULT 10,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  email text,
  role text,
  created_at timestamptz,
  collection_count bigint,
  last_active timestamptz,
  metadata jsonb
) 
SECURITY DEFINER
SET search_path = public, auth
AS $$
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
  LEFT JOIN public.user_profiles p ON p.id = u.id
  LEFT JOIN (
    SELECT 
      user_id,
      COUNT(*) as collection_count
    FROM public.collections
    GROUP BY user_id
  ) uc ON uc.user_id = u.id
  WHERE 
    (p_search IS NULL OR u.email ILIKE '%' || p_search || '%')
    AND (p_role IS NULL OR p.role = p_role)
  ORDER BY u.created_at DESC
  LIMIT LEAST(p_limit, 100)
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Ensure proper permissions
REVOKE ALL ON FUNCTION public.admin_list_users(text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text, text, integer, integer) TO service_role;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

-- Verify function exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_proc 
    WHERE proname = 'admin_list_users' 
    AND pronamespace = 'public'::regnamespace
  ) THEN
    RAISE EXCEPTION 'Function public.admin_list_users was not created properly';
  END IF;
END $$; 