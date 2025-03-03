-- Drop existing functions
DROP FUNCTION IF EXISTS public.list_users() CASCADE;
DROP FUNCTION IF EXISTS public.delete_user(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.change_user_role(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.update_user(uuid, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.admin_list_users(text, text, int, int) CASCADE;
DROP FUNCTION IF EXISTS public.admin_create_user(text, text, text, jsonb) CASCADE;

-- Create standardized list_users function
CREATE OR REPLACE FUNCTION public.list_users()
RETURNS TABLE (
  id uuid,
  email text,
  role text,
  created_at timestamptz,
  collections_count bigint,
  access_count bigint
) AS $$
BEGIN
  -- Verify caller is admin using auth.is_admin()
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin can list users';
  END IF;

  RETURN QUERY
  SELECT 
    u.id,
    u.email::text,
    COALESCE(p.role, 'user')::text as role,
    u.created_at,
    COUNT(DISTINCT c.id) as collections_count,
    COUNT(DISTINCT ca.collection_id) as access_count
  FROM auth.users u
  LEFT JOIN user_profiles p ON p.id = u.id
  LEFT JOIN collections c ON c.user_id = u.id
  LEFT JOIN collection_access ca ON ca.user_id = u.id
  WHERE u.email != 'admin420@merchant.local'  -- Exclude admin420
  GROUP BY u.id, u.email, p.role, u.created_at
  ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create standardized delete_user function
CREATE OR REPLACE FUNCTION public.delete_user(p_user_id uuid)
RETURNS void AS $$
BEGIN
  -- Verify caller is admin using auth.is_admin()
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin can delete users';
  END IF;

  -- Don't allow deleting admin420
  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = p_user_id
    AND email = 'admin420@merchant.local'
  ) THEN
    RAISE EXCEPTION 'Cannot delete admin user';
  END IF;

  -- Delete user from auth.users (will cascade to user_profiles)
  DELETE FROM auth.users
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create standardized change_user_role function
CREATE OR REPLACE FUNCTION public.change_user_role(p_user_id uuid, p_new_role text)
RETURNS void AS $$
BEGIN
  -- Verify caller is admin using auth.is_admin()
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin can change user roles';
  END IF;

  -- Validate role
  IF p_new_role NOT IN ('user', 'merchant', 'admin') THEN
    RAISE EXCEPTION 'Invalid role. Must be one of: user, merchant, admin';
  END IF;

  -- Don't allow modifying admin420
  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = p_user_id
    AND email = 'admin420@merchant.local'
  ) THEN
    RAISE EXCEPTION 'Cannot modify admin user role';
  END IF;

  -- Update or insert profile with proper type casting
  INSERT INTO user_profiles (id, role, updated_at)
  VALUES (p_user_id, p_new_role::user_role, now())
  ON CONFLICT (id) DO UPDATE
  SET 
    role = EXCLUDED.role,
    updated_at = EXCLUDED.updated_at;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create standardized update_user function
CREATE OR REPLACE FUNCTION public.update_user(
  p_user_id uuid,
  p_username text,
  p_role text
)
RETURNS void AS $$
BEGIN
  -- Verify caller is admin using auth.is_admin()
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin can update users';
  END IF;

  -- Don't allow modifying admin420
  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = p_user_id
    AND email = 'admin420@merchant.local'
  ) THEN
    RAISE EXCEPTION 'Cannot modify admin user';
  END IF;

  -- Validate username
  IF NOT (p_username ~ '^[a-zA-Z0-9_-]{3,20}$') THEN
    RAISE EXCEPTION 'Invalid username. Use 3-20 characters, letters, numbers, underscore or hyphen only.';
  END IF;

  -- Check if new username is taken by another user
  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE email = p_username || '@merchant.local'
    AND id != p_user_id
  ) THEN
    RAISE EXCEPTION 'Username already taken';
  END IF;

  -- Update user
  UPDATE auth.users
  SET 
    email = p_username || '@merchant.local',
    raw_app_meta_data = jsonb_build_object(
      'provider', 'username',
      'providers', array['username'],
      'username', p_username
    ),
    raw_user_meta_data = jsonb_build_object(
      'username', p_username
    )
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Update role
  INSERT INTO user_profiles (id, role)
  VALUES (p_user_id, p_role)
  ON CONFLICT (id) DO UPDATE 
  SET role = EXCLUDED.role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create standardized admin_list_users function
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
BEGIN
  -- Verify caller is admin using auth.is_admin()
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin can list users';
  END IF;

  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    COALESCE(p.role, 'user')::text as role,
    u.created_at,
    COUNT(DISTINCT c.id) as collection_count,
    u.last_sign_in_at,
    u.raw_app_meta_data
  FROM auth.users u
  LEFT JOIN user_profiles p ON p.id = u.id
  LEFT JOIN collections c ON c.user_id = u.id
  WHERE 
    (p_search IS NULL OR u.email ILIKE '%' || p_search || '%')
    AND (p_role IS NULL OR p.role = p_role)
  GROUP BY u.id, u.email, p.role, u.created_at, u.last_sign_in_at, u.raw_app_meta_data
  ORDER BY u.created_at DESC
  LIMIT LEAST(p_limit, 100)
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create standardized admin_create_user function
CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_email text,
  p_password text,
  p_role text DEFAULT 'user',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Verify caller is admin using auth.is_admin()
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin can create users';
  END IF;

  -- Validate role
  IF p_role NOT IN ('user', 'merchant', 'admin') THEN
    RAISE EXCEPTION 'Invalid role. Must be one of: user, merchant, admin';
  END IF;

  -- Create user
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
    p_metadata || jsonb_build_object('role', p_role),
    p_metadata || jsonb_build_object('role', p_role),
    'authenticated',
    now(),
    now()
  )
  RETURNING id INTO v_user_id;

  -- Create profile
  INSERT INTO user_profiles (id, role)
  VALUES (v_user_id, p_role);

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_user_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text, text, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_user(text, text, text, jsonb) TO authenticated;

-- Add documentation
COMMENT ON FUNCTION public.list_users() IS 'Lists all users (admin only)';
COMMENT ON FUNCTION public.delete_user(uuid) IS 'Deletes a user (admin only)';
COMMENT ON FUNCTION public.change_user_role(uuid, text) IS 'Changes a user''s role (admin only)';
COMMENT ON FUNCTION public.update_user(uuid, text, text) IS 'Updates a user''s details (admin only)';
COMMENT ON FUNCTION public.admin_list_users(text, text, int, int) IS 'Lists users with advanced filtering (admin only)';
COMMENT ON FUNCTION public.admin_create_user(text, text, text, jsonb) IS 'Creates a new user (admin only)';

-- Refresh schema cache
NOTIFY pgrst, 'reload schema'; 