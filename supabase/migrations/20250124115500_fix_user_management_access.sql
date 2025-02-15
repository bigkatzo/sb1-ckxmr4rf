-- Drop existing functions and policies
DO $$ BEGIN
  DROP FUNCTION IF EXISTS auth.is_admin() CASCADE;
  DROP FUNCTION IF EXISTS admin_list_users(text, text, int, int) CASCADE;
  DROP POLICY IF EXISTS "users_read_own_profile" ON user_profiles;
  DROP POLICY IF EXISTS "admin_manage_profiles" ON user_profiles;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create admin check function
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  -- Direct email check for admin420
  RETURN NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'email', '') = 'admin420@merchant.local';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create admin_list_users function
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
    u.email != 'admin420@merchant.local' -- Exclude admin420 from the list
    AND (p_search IS NULL OR u.email ILIKE '%' || p_search || '%')
    AND (p_role IS NULL OR p.role = p_role)
  ORDER BY u.created_at DESC
  LIMIT LEAST(p_limit, 100)
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure admin420 has correct profile
DO $$ 
DECLARE
  v_admin_id uuid;
BEGIN
  -- Get or create admin420's user ID
  SELECT id INTO v_admin_id
  FROM auth.users
  WHERE email = 'admin420@merchant.local'
  LIMIT 1;

  IF v_admin_id IS NOT NULL THEN
    -- Ensure admin profile exists
    INSERT INTO user_profiles (id, role)
    VALUES (v_admin_id, 'admin')
    ON CONFLICT (id) DO UPDATE 
    SET role = 'admin';
  END IF;
END $$;

-- Ensure RLS is enabled
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_profiles
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

-- Create RLS policies for auth.users
CREATE POLICY "users_read_own_auth"
  ON auth.users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR auth.is_admin());

CREATE POLICY "admin_manage_auth"
  ON auth.users
  FOR ALL
  TO authenticated
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin());

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_list_users(text, text, int, int) TO authenticated;

-- Grant table permissions
GRANT ALL ON user_profiles TO authenticated;
GRANT ALL ON auth.users TO authenticated;
GRANT ALL ON collections TO authenticated;

-- Create admin_create_user function
CREATE OR REPLACE FUNCTION admin_create_user(
  p_email text,
  p_password text,
  p_role text DEFAULT 'user',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Verify caller is admin
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin users can create users';
  END IF;

  -- Create user in auth.users
  INSERT INTO auth.users (
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    role,
    created_at,
    updated_at
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    jsonb_build_object('role', p_role) || p_metadata,
    jsonb_build_object('role', p_role) || p_metadata,
    'authenticated',
    now(),
    now()
  )
  RETURNING id INTO v_user_id;

  -- Create user profile
  INSERT INTO user_profiles (id, role)
  VALUES (v_user_id, p_role);

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create admin_update_user function
CREATE OR REPLACE FUNCTION admin_update_user(
  p_user_id uuid,
  p_email text DEFAULT NULL,
  p_password text DEFAULT NULL,
  p_role text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  -- Verify caller is admin
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin users can update users';
  END IF;

  -- Update email if provided
  IF p_email IS NOT NULL THEN
    UPDATE auth.users
    SET 
      email = p_email,
      updated_at = now()
    WHERE id = p_user_id;
  END IF;

  -- Update password if provided
  IF p_password IS NOT NULL THEN
    UPDATE auth.users
    SET 
      encrypted_password = crypt(p_password, gen_salt('bf')),
      updated_at = now()
    WHERE id = p_user_id;
  END IF;

  -- Update role if provided
  IF p_role IS NOT NULL THEN
    UPDATE user_profiles
    SET role = p_role
    WHERE id = p_user_id;

    -- Update role in user metadata
    UPDATE auth.users
    SET 
      raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', p_role),
      raw_user_meta_data = raw_user_meta_data || jsonb_build_object('role', p_role),
      updated_at = now()
    WHERE id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute on admin functions
GRANT EXECUTE ON FUNCTION admin_create_user(text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_user(uuid, text, text, text) TO authenticated; 