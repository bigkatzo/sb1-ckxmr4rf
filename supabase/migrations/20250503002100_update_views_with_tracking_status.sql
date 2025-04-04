BEGIN;

-- Drop existing views
DROP VIEW IF EXISTS user_orders CASCADE;
DROP VIEW IF EXISTS merchant_orders CASCADE;

-- Recreate user orders view with tracking status
CREATE OR REPLACE VIEW user_orders AS
SELECT 
    o.id,
    o.order_number,
    o.collection_id,
    o.product_id,
    o.wallet_address,
    o.transaction_signature,
    o.shipping_address,
    o.contact_info,
    o.status,
    o.amount_sol,
    o.created_at,
    o.updated_at,
    o.tracking_number,
    o.tracking_status,
    o.tracking_details,
    o.variant_selections as order_variants,
    p.name as product_name,
    p.variants as product_variants,
    p.variant_prices as product_variant_prices,
    p.images as product_images,
    p.sku as product_sku,
    c.name as collection_name
FROM orders o
JOIN products p ON p.id = o.product_id
JOIN collections c ON c.id = o.collection_id
WHERE o.wallet_address = auth.jwt()->>'wallet_address';

-- Recreate merchant orders view with tracking status
CREATE OR REPLACE VIEW merchant_orders AS
SELECT 
    o.id,
    o.order_number,
    o.created_at,
    o.updated_at,
    o.status,
    o.amount_sol,
    o.wallet_address,
    o.transaction_signature,
    o.shipping_address,
    o.contact_info,
    o.variant_selections,
    o.product_id,
    o.collection_id,
    o.product_snapshot,
    o.collection_snapshot,
    o.tracking_number,
    o.tracking_status,
    o.tracking_details,
    p.name as product_name,
    p.sku as product_sku,
    p.images[1] as product_image_url,
    p.variants as product_variants,
    p.variant_prices as product_variant_prices,
    p.category_id,
    c.name as collection_name,
    c.user_id as collection_owner_id,
    cat.name as category_name,
    cat.description as category_description,
    cat.type as category_type,
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
LEFT JOIN categories cat ON cat.id = p.category_id
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

-- Grant permissions
GRANT SELECT ON user_orders TO authenticated;
GRANT SELECT ON merchant_orders TO authenticated;

COMMIT; 