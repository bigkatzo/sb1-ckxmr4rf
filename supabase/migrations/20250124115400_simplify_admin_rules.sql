-- Drop existing functions to recreate them
DO $$ BEGIN
  DROP FUNCTION IF EXISTS auth.is_admin() CASCADE;
  DROP FUNCTION IF EXISTS admin_list_users(text, text, int, int) CASCADE;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create simplified admin check function
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  -- Simple check if user has admin role in their profile
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create simplified admin_list_users function
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
BEGIN
  -- Verify caller is admin
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin users can list users';
  END IF;

  -- Return users
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure proper permissions
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT ALL ON auth.users TO authenticated;
GRANT ALL ON user_profiles TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_list_users(text, text, int, int) TO authenticated;

-- Ensure RLS is enabled
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Recreate RLS policies with simplified rules
DROP POLICY IF EXISTS "users_read_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "admin_manage_profiles" ON user_profiles;

-- Users can read their own profile, admins can read all
CREATE POLICY "users_read_own_profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR auth.is_admin());

-- Only admins can manage profiles
CREATE POLICY "admin_manage_profiles"
  ON user_profiles
  FOR ALL
  TO authenticated
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin()); 