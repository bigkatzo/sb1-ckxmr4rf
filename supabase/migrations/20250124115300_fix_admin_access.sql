-- Drop existing functions to recreate them with better error handling
DO $$ BEGIN
  DROP FUNCTION IF EXISTS auth.is_admin() CASCADE;
  DROP FUNCTION IF EXISTS admin_list_users(text, text, int, int) CASCADE;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create improved admin check function with better error handling
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
DECLARE
  v_user_id uuid;
  v_user_email text;
  v_has_profile boolean;
  v_debug jsonb;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  -- Exit early if no user ID
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No authenticated user found';
  END IF;

  -- Get user email
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = v_user_id;

  -- Check if user has a profile
  SELECT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = v_user_id
  ) INTO v_has_profile;

  -- If admin420 but no profile, create it
  IF v_user_email = 'admin420@merchant.local' AND NOT v_has_profile THEN
    INSERT INTO user_profiles (id, role)
    VALUES (v_user_id, 'admin')
    ON CONFLICT (id) DO UPDATE
    SET role = 'admin';
    RETURN true;
  END IF;

  -- Build debug info
  v_debug := jsonb_build_object(
    'user_id', v_user_id,
    'email', v_user_email,
    'has_profile', v_has_profile
  );

  -- Check if user is admin
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = v_user_id
    AND role = 'admin'
  );
EXCEPTION
  WHEN others THEN
    RAISE EXCEPTION 'Error in is_admin check: %. Debug info: %', SQLERRM, v_debug;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create improved admin_list_users function with better error handling
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
  v_user_email text;
  v_is_admin boolean;
  v_debug jsonb;
BEGIN
  -- Get current user info
  v_user_id := auth.uid();
  
  -- Exit if no user ID
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No authenticated user found';
  END IF;

  -- Get user email
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = v_user_id;

  -- Check admin status with error capture
  BEGIN
    SELECT auth.is_admin() INTO v_is_admin;
  EXCEPTION
    WHEN others THEN
      RAISE EXCEPTION 'Error checking admin status: %', SQLERRM;
  END;

  -- Build debug info
  v_debug := jsonb_build_object(
    'user_id', v_user_id,
    'email', v_user_email,
    'is_admin', v_is_admin
  );
  
  -- Exit if not admin
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'User is not an admin. Debug info: %', v_debug;
  END IF;

  -- Return users with better error handling
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
EXCEPTION
  WHEN others THEN
    RAISE EXCEPTION 'Error in admin_list_users: %. Debug info: %', SQLERRM, v_debug;
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

-- Recreate RLS policies
DROP POLICY IF EXISTS "users_read_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "admin_manage_profiles" ON user_profiles;

CREATE POLICY "users_read_own_profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR auth.is_admin());

CREATE POLICY "admin_manage_profiles"
  ON user_profiles
  FOR ALL
  TO authenticated
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin()); 