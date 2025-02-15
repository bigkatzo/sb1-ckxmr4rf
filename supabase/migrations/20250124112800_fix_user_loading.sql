-- Simplify admin_list_users to avoid collections dependency
DROP FUNCTION IF EXISTS admin_list_users(text, text, int, int);
CREATE OR REPLACE FUNCTION admin_list_users(
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
  -- First check if user is admin
  SELECT auth.is_admin() INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Only admin can list users';
  END IF;

  -- Return users with a simpler query that doesn't depend on collections
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    COALESCE(p.role, 'user')::text as role,
    u.created_at,
    0::bigint as collection_count, -- Default to 0 for now
    u.last_sign_in_at,
    u.raw_app_meta_data
  FROM auth.users u
  LEFT JOIN user_profiles p ON p.id = u.id
  WHERE 
    (p_search IS NULL OR u.email ILIKE '%' || p_search || '%')
    AND (p_role IS NULL OR p.role = p_role)
  ORDER BY u.created_at DESC
  LIMIT LEAST(p_limit, 100)
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure proper permissions
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_list_users(text, text, int, int) TO authenticated;

-- Ensure RLS is enabled and policies are correct
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Recreate RLS policies
DROP POLICY IF EXISTS "user_profiles_select_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_all_admin_policy" ON user_profiles;

CREATE POLICY "user_profiles_select_policy"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR (SELECT auth.is_admin()));

CREATE POLICY "user_profiles_all_admin_policy"
  ON user_profiles
  FOR ALL
  TO authenticated
  USING ((SELECT auth.is_admin()))
  WITH CHECK ((SELECT auth.is_admin()));

-- Ensure admin profile exists for current user if they are admin
DO $$ 
DECLARE
  v_user_id uuid;
  v_user_email text;
BEGIN
  SELECT id, email 
  FROM auth.users 
  WHERE id = auth.uid()
  INTO v_user_id, v_user_email;

  IF v_user_id IS NOT NULL THEN
    -- If user is admin in metadata, ensure they have admin profile
    IF (SELECT raw_app_meta_data->>'role' = 'admin' FROM auth.users WHERE id = v_user_id) THEN
      INSERT INTO user_profiles (id, role)
      VALUES (v_user_id, 'admin')
      ON CONFLICT (id) DO UPDATE
      SET role = 'admin';
    END IF;
  END IF;
END $$; 