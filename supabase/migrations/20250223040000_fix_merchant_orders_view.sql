-- Start transaction
BEGIN;

-- Drop and recreate the view
DROP VIEW IF EXISTS merchant_orders;

-- Create the updated view with product image and proper access control
CREATE VIEW merchant_orders AS
SELECT 
    o.*,
    p.name as product_name,
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
FROM orders o
JOIN products p ON p.id = o.product_id
JOIN collections c ON c.id = o.collection_id
LEFT JOIN collection_access ca ON ca.collection_id = c.id AND ca.user_id = auth.uid()
WHERE
    -- Only show orders that match the access rules
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

-- Grant permissions on the view
GRANT SELECT ON merchant_orders TO authenticated;

COMMIT; 