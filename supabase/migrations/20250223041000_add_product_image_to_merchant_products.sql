-- Start transaction
BEGIN;

-- Drop and recreate the view
DROP VIEW IF EXISTS merchant_products CASCADE;

-- Create updated view with product image
CREATE VIEW merchant_products AS
SELECT 
    p.*,
    p.images[1] as product_image_url,
    c.name as collection_name,
    c.user_id as collection_owner_id,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid()
            AND up.role = 'admin'
        ) THEN 'admin'
        WHEN c.user_id = auth.uid() THEN 'owner'
        WHEN ca.access_type IS NOT NULL THEN ca.access_type
        ELSE NULL
    END as access_type
FROM products p
JOIN collections c ON c.id = p.collection_id
LEFT JOIN collection_access ca ON ca.collection_id = c.id AND ca.user_id = auth.uid()
WHERE 
    EXISTS (
        SELECT 1 FROM user_profiles up
        WHERE up.id = auth.uid()
        AND up.role = 'admin'
    )
    OR
    c.user_id = auth.uid()
    OR
    EXISTS (
        SELECT 1 FROM collection_access ca2
        WHERE ca2.collection_id = c.id
        AND ca2.user_id = auth.uid()
        AND ca2.access_type IN ('view', 'edit')
    );

-- Grant permissions
GRANT SELECT ON merchant_products TO authenticated;

-- Recreate the get_merchant_products function to match the updated view
CREATE OR REPLACE FUNCTION get_merchant_products(p_collection_id uuid)
RETURNS SETOF merchant_products
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT *
    FROM merchant_products
    WHERE collection_id = p_collection_id;
$$;

COMMIT; 