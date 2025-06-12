-- Drop existing function
DROP FUNCTION IF EXISTS list_users();

-- Create updated list_users function that includes merchant_tier
CREATE OR REPLACE FUNCTION list_users()
RETURNS TABLE (
  id uuid,
  email text,
  role text,
  merchant_tier merchant_tier,
  created_at timestamptz,
  collections_count bigint,
  access_count bigint
) AS $$
BEGIN
  -- Verify caller is admin
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin can list users';
  END IF;

  RETURN QUERY
  SELECT 
    u.id,
    u.email::text,
    COALESCE(p.role, 'user')::text as role,
    COALESCE(p.merchant_tier, 'starter_merchant')::merchant_tier as merchant_tier,
    u.created_at,
    COUNT(DISTINCT c.id) as collections_count,
    COUNT(DISTINCT ca.collection_id) as access_count
  FROM auth.users u
  LEFT JOIN user_profiles p ON p.id = u.id
  LEFT JOIN collections c ON c.user_id = u.id
  LEFT JOIN collection_access ca ON ca.user_id = u.id
  GROUP BY u.id, u.email, p.role, p.merchant_tier
  ORDER BY 
    -- Admin420 first, then sort by creation date
    CASE WHEN u.email = 'admin420@merchant.local' THEN 0 ELSE 1 END,
    u.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION list_users() TO authenticated;

-- Ensure admin420 has a merchant tier set
DO $$
DECLARE
  v_admin_id uuid;
BEGIN
  -- Get admin420's ID
  SELECT id INTO v_admin_id
  FROM auth.users
  WHERE email = 'admin420@merchant.local';

  -- If admin420 exists, ensure they have a merchant tier
  IF v_admin_id IS NOT NULL THEN
    INSERT INTO user_profiles (id, role, merchant_tier)
    VALUES (v_admin_id, 'admin', 'starter_merchant')
    ON CONFLICT (id) DO UPDATE
    SET merchant_tier = COALESCE(user_profiles.merchant_tier, 'starter_merchant');
  END IF;
END $$; 