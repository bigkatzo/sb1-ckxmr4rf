-- Drop and recreate auth.is_admin with better error handling
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
DECLARE
  v_user_id uuid;
  v_user_role text;
  v_user_email text;
  v_has_profile boolean;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  -- Exit early if no user ID
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Get user email and metadata role
  SELECT 
    email,
    COALESCE(raw_app_meta_data->>'role', 'user') as role
  INTO v_user_email, v_user_role
  FROM auth.users
  WHERE id = v_user_id;

  -- Check if user has a profile
  SELECT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = v_user_id
  ) INTO v_has_profile;

  -- If user has admin role in metadata but no profile, create it
  IF v_user_role = 'admin' AND NOT v_has_profile THEN
    INSERT INTO user_profiles (id, role)
    VALUES (v_user_id, 'admin')
    ON CONFLICT (id) DO UPDATE
    SET role = 'admin';
  END IF;

  -- Return true if user has admin role in profile
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = v_user_id
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate admin_list_users with better error handling
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
  v_user_id uuid;
  v_is_admin boolean;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  -- Exit if no user ID
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No authenticated user found';
  END IF;

  -- Check admin status
  SELECT auth.is_admin() INTO v_is_admin;
  
  -- Exit if not admin
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'User % is not an admin', v_user_id;
  END IF;

  -- Return users
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    COALESCE(p.role, 'user')::text as role,
    u.created_at,
    0::bigint as collection_count,
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
GRANT USAGE ON SCHEMA auth TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION admin_list_users(text, text, int, int) TO authenticated;

-- Ensure RLS is enabled
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Recreate RLS policies with simpler conditions
DROP POLICY IF EXISTS "user_profiles_select_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_all_admin_policy" ON user_profiles;

CREATE POLICY "user_profiles_select_policy"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR auth.is_admin());

CREATE POLICY "user_profiles_all_admin_policy"
  ON user_profiles
  FOR ALL
  TO authenticated
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin());

-- Create a function to debug user permissions
CREATE OR REPLACE FUNCTION debug_user_permissions()
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_result jsonb;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  -- Build debug info
  SELECT jsonb_build_object(
    'user_id', v_user_id,
    'email', u.email,
    'metadata_role', u.raw_app_meta_data->>'role',
    'profile_exists', EXISTS (SELECT 1 FROM user_profiles WHERE id = v_user_id),
    'profile_role', p.role,
    'is_admin', auth.is_admin()
  )
  INTO v_result
  FROM auth.users u
  LEFT JOIN user_profiles p ON p.id = u.id
  WHERE u.id = v_user_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute on debug function
GRANT EXECUTE ON FUNCTION debug_user_permissions() TO authenticated;

-- Ensure current user has correct profile
DO $$ 
DECLARE
  v_user_id uuid;
  v_user_role text;
BEGIN
  -- Get current user
  SELECT 
    id,
    COALESCE(raw_app_meta_data->>'role', 'user')
  INTO v_user_id, v_user_role
  FROM auth.users
  WHERE id = auth.uid();

  -- Create/update profile if needed
  IF v_user_id IS NOT NULL THEN
    INSERT INTO user_profiles (id, role)
    VALUES (v_user_id, v_user_role)
    ON CONFLICT (id) DO UPDATE
    SET role = EXCLUDED.role;
  END IF;
END $$; 