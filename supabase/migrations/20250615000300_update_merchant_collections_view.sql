-- Start transaction
BEGIN;

-- Drop existing view
DROP VIEW IF EXISTS merchant_collections CASCADE;

-- Create updated merchant_collections view with URL fields
CREATE VIEW merchant_collections AS
SELECT 
  c.id,
  c.name,
  c.description,
  c.image_url,
  c.launch_date,
  c.featured,
  c.visible,
  c.sale_ended,
  c.slug,
  c.user_id,
  c.created_at,
  c.updated_at,
  c.custom_url,
  c.x_url,
  c.telegram_url,
  c.dexscreener_url,
  c.pumpfun_url,
  c.website_url,
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

-- Verify URL fields are included
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'merchant_collections'
    AND column_name = 'custom_url'
  ) THEN
    RAISE EXCEPTION 'URL fields are missing from merchant_collections view';
  END IF;
END $$;

COMMIT; 