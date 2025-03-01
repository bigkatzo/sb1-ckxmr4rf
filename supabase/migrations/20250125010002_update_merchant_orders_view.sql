-- Start transaction
BEGIN;

-- Drop existing view
DROP VIEW IF EXISTS merchant_orders CASCADE;

-- Create updated merchant dashboard view for orders
CREATE OR REPLACE VIEW merchant_orders AS
SELECT 
    o.*,
    p.name as product_name,
    p.sku as product_sku,
    p.images as product_images,
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
LEFT JOIN collection_access ca ON ca.collection_id = c.id AND ca.user_id = auth.uid()
WHERE 
    -- Collection owners can view orders
    c.user_id = auth.uid()
    OR
    -- Users with collection access can view orders
    EXISTS (
        SELECT 1 FROM collection_access
        WHERE collection_id = c.id
        AND user_id = auth.uid()
        AND access_type IN ('view', 'edit')
    )
    OR
    -- Admins can view all orders
    EXISTS (
        SELECT 1 FROM user_profiles up
        WHERE up.id = auth.uid()
        AND up.role = 'admin'
    );

-- Grant permissions
GRANT SELECT ON merchant_orders TO authenticated;

COMMIT; 