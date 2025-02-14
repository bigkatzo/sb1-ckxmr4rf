-- Drop existing list_users function
DROP FUNCTION IF EXISTS list_users();

-- Create fixed list_users function with proper type handling
CREATE OR REPLACE FUNCTION list_users()
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
    CAST(u.email AS text), -- Explicitly cast email to text
    COALESCE(p.role, 'user'::text) as role, -- Ensure role is text
    u.created_at
  FROM auth.users u
  LEFT JOIN user_profiles p ON p.id = u.id
  WHERE u.email != 'admin420@merchant.local' -- Exclude admin from list
  ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION list_users() TO authenticated;