-- First, verify and recreate the auth.is_admin function
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate admin_list_users with simpler implementation first
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

  -- Return users with a simpler query first
  RETURN QUERY
  WITH user_collections AS (
    SELECT 
      user_id,
      COUNT(*) as collection_count
    FROM collections
    GROUP BY user_id
  )
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
  LEFT JOIN user_collections uc ON uc.user_id = u.id
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

-- Create a test admin user if none exists
DO $$ 
DECLARE
  v_admin_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM user_profiles WHERE role = 'admin'
  ) INTO v_admin_exists;

  IF NOT v_admin_exists THEN
    -- Create a test admin user
    INSERT INTO auth.users (
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      role
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      'admin@test.com',
      crypt('adminpass123', gen_salt('bf')),
      now(),
      '{"role": "admin"}'::jsonb,
      '{"role": "admin"}'::jsonb,
      'authenticated'
    );

    -- Ensure admin profile exists
    INSERT INTO user_profiles (id, role)
    SELECT id, 'admin'
    FROM auth.users
    WHERE email = 'admin@test.com'
    ON CONFLICT (id) DO UPDATE
    SET role = 'admin';
  END IF;
END $$; 