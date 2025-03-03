-- Start transaction
BEGIN;

-- Drop existing view
DROP VIEW IF EXISTS merchant_collections CASCADE;

-- Create updated merchant_collections view
CREATE VIEW merchant_collections AS
SELECT 
  c.*,
  u.email as owner_username,  -- Get full email from auth.users
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'admin'
    ) THEN 'admin'
    WHEN c.user_id = auth.uid() THEN NULL  -- User owns the collection
    WHEN ca.access_type IS NOT NULL THEN ca.access_type  -- User has explicit access (view/edit)
    ELSE NULL
  END as access_type
FROM collections c
JOIN auth.users u ON u.id = c.user_id
LEFT JOIN collection_access ca ON ca.collection_id = c.id AND ca.user_id = auth.uid()
WHERE 
  (SELECT is_admin()) OR  -- Admin can see all collections
  c.user_id = auth.uid() OR  -- User owns the collection
  ca.collection_id IS NOT NULL;  -- User has access through collection_access

-- Grant permissions
GRANT SELECT ON merchant_collections TO authenticated;

-- Recreate the get_merchant_collections function
CREATE OR REPLACE FUNCTION get_merchant_collections()
RETURNS SETOF merchant_collections
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM merchant_collections
  ORDER BY created_at DESC;
$$;

COMMIT; 