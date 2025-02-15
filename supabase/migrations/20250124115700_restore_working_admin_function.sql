-- Drop existing functions to ensure clean slate
DROP FUNCTION IF EXISTS admin_list_users(text, text, int, int) CASCADE;
DROP FUNCTION IF EXISTS auth.is_admin() CASCADE;

-- Restore the working version of is_admin function
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  -- Direct email check for admin420
  RETURN NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'email', '') = 'admin420@merchant.local';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Restore the working version of admin_list_users
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
  -- Verify admin status
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin users can list users';
  END IF;

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

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_list_users(text, text, int, int) TO authenticated; 