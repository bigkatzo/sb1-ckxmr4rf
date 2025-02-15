-- Drop existing admin functions to recreate them
DROP FUNCTION IF EXISTS admin_list_users();
DROP FUNCTION IF EXISTS admin_create_user(text, text, text);

-- Create improved admin_list_users function
CREATE OR REPLACE FUNCTION admin_list_users()
RETURNS TABLE (
  id uuid,
  email text,
  role text,
  created_at timestamptz
) AS $$
BEGIN
  -- Verify caller is admin
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin can list users';
  END IF;

  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    COALESCE(p.role, 'user') as role,
    u.created_at
  FROM auth.users u
  LEFT JOIN user_profiles p ON p.id = u.id
  ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create admin_create_user function
CREATE OR REPLACE FUNCTION admin_create_user(
  p_email text,
  p_password text,
  p_role text DEFAULT 'user'
)
RETURNS uuid AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Verify caller is admin
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin can create users';
  END IF;

  -- Validate role
  IF p_role NOT IN ('admin', 'merchant', 'user') THEN
    RAISE EXCEPTION 'Invalid role. Must be admin, merchant, or user';
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
    jsonb_build_object('role', p_role),
    jsonb_build_object('role', p_role),
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

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_create_user(text, text, text) TO authenticated;
GRANT ALL ON auth.users TO authenticated;
GRANT ALL ON user_profiles TO authenticated;

-- Ensure RLS is enabled
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Update RLS policies
DROP POLICY IF EXISTS "user_profiles_select_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_all_admin_policy" ON user_profiles;

CREATE POLICY "user_profiles_select_policy"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() 
    OR auth.is_admin()
  );

CREATE POLICY "user_profiles_all_admin_policy"
  ON user_profiles
  FOR ALL
  TO authenticated
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin()); 