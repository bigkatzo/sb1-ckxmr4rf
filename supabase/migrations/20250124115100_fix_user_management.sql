-- Drop existing functions to recreate them
DROP FUNCTION IF EXISTS admin_list_users(text, text, int, int);
DROP FUNCTION IF EXISTS admin_create_user(text, text, text, jsonb);
DROP FUNCTION IF EXISTS admin_update_user(uuid, text, text, text);

-- Create improved admin_list_users function
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
    RAISE EXCEPTION 'Only admin can list users';
  END IF;

  -- Return users with collection counts
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

-- Create improved admin_create_user function
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
    RAISE EXCEPTION 'Only admin can create users';
  END IF;

  -- Validate role
  IF p_role NOT IN ('admin', 'merchant', 'user') THEN
    RAISE EXCEPTION 'Invalid role. Must be admin, merchant, or user';
  END IF;

  -- Validate email format
  IF NOT (p_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') THEN
    RAISE EXCEPTION 'Invalid email format';
  END IF;

  -- Validate password length
  IF LENGTH(p_password) < 8 THEN
    RAISE EXCEPTION 'Password must be at least 8 characters long';
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

-- Create function to update user
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
    RAISE EXCEPTION 'Only admin can update users';
  END IF;

  -- Validate role if provided
  IF p_role IS NOT NULL AND p_role NOT IN ('admin', 'merchant', 'user') THEN
    RAISE EXCEPTION 'Invalid role. Must be admin, merchant, or user';
  END IF;

  -- Update email if provided
  IF p_email IS NOT NULL THEN
    IF NOT (p_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') THEN
      RAISE EXCEPTION 'Invalid email format';
    END IF;

    UPDATE auth.users
    SET 
      email = p_email,
      updated_at = now()
    WHERE id = p_user_id;
  END IF;

  -- Update password if provided
  IF p_password IS NOT NULL THEN
    IF LENGTH(p_password) < 8 THEN
      RAISE EXCEPTION 'Password must be at least 8 characters long';
    END IF;

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

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT ALL ON auth.users TO authenticated;
GRANT ALL ON user_profiles TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_list_users(text, text, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_create_user(text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_user(uuid, text, text, text) TO authenticated; 