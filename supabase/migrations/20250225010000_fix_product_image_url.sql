-- Start transaction
BEGIN;

-- Drop existing view
DROP VIEW IF EXISTS merchant_orders CASCADE;

-- Recreate merchant orders view with correct image URL
CREATE OR REPLACE VIEW merchant_orders AS
SELECT 
    o.*,
    p.name as product_name,
    p.sku as product_sku,
    p.images[1] as product_image_url,
    c.name as collection_name,
    c.user_id as collection_owner_id,
    CASE 
        WHEN c.user_id = auth.uid() THEN 'edit'
        WHEN ca.access_type IS NOT NULL THEN ca.access_type
        ELSE NULL
    END as access_type
FROM orders o
JOIN products p ON p.id = o.product_id
JOIN collections c ON c.id = o.collection_id
LEFT JOIN collection_access ca ON ca.collection_id = c.id AND ca.user_id = auth.uid();

-- Grant permissions
GRANT SELECT ON merchant_orders TO authenticated;

COMMIT; 