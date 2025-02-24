-- Drop existing admin functions
DROP FUNCTION IF EXISTS is_admin() CASCADE;
DROP FUNCTION IF EXISTS is_super_admin() CASCADE;
DROP FUNCTION IF EXISTS list_users() CASCADE;
DROP FUNCTION IF EXISTS change_user_role(uuid, text) CASCADE;

-- Function to check if user is an admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM user_profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  );
$$;

-- Function to check if user is a super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM user_profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
    AND is_super_admin = true
  );
$$;

-- Function to list all users (admin only)
CREATE OR REPLACE FUNCTION list_users()
RETURNS TABLE (
  id uuid,
  email text,
  role text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied. Only admins can list users.';
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
$$;

-- Function to change a user's role (admin only)
CREATE OR REPLACE FUNCTION change_user_role(p_user_id uuid, p_new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if current user is admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied. Only admins can change user roles.';
  END IF;

  -- Validate role
  IF p_new_role NOT IN ('user', 'merchant', 'admin') THEN
    RAISE EXCEPTION 'Invalid role. Must be one of: user, merchant, admin';
  END IF;

  -- Check if target user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- If changing to admin role, check if current user is super admin
  IF p_new_role = 'admin' AND NOT is_super_admin() THEN
    RAISE EXCEPTION 'Only super admins can create new admins';
  END IF;

  -- Update or insert profile
  INSERT INTO user_profiles (id, role, updated_at)
  VALUES (p_user_id, p_new_role, now())
  ON CONFLICT (id) DO UPDATE
  SET 
    role = EXCLUDED.role,
    updated_at = EXCLUDED.updated_at;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION change_user_role(uuid, text) TO authenticated;

-- Add documentation
COMMENT ON FUNCTION is_admin() IS 'Checks if the current user is an admin';
COMMENT ON FUNCTION is_super_admin() IS 'Checks if the current user is a super admin';
COMMENT ON FUNCTION list_users() IS 'Lists all users (admin only)';
COMMENT ON FUNCTION change_user_role(uuid, text) IS 'Changes a user''s role (admin only)'; 