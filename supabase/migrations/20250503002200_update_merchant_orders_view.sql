-- Update merchant orders view to include tracking information
BEGIN;

-- Drop existing view
DROP VIEW IF EXISTS merchant_orders CASCADE;

-- Recreate merchant orders view with tracking info
CREATE OR REPLACE VIEW merchant_orders AS
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
    o.variant_selections as order_variants,
    p.name as product_name,
    p.sku as product_sku,
    p.images[1] as product_image_url,
    p.variants as product_variants,
    p.variant_prices as product_variant_prices,
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
    END as access_type,
    -- Add tracking information as a JSON object
    CASE 
        WHEN t.id IS NOT NULL THEN 
            jsonb_build_object(
                'tracking_number', t.tracking_number,
                'carrier', t.carrier,
                'status', t.status,
                'status_details', t.status_details,
                'estimated_delivery_date', t.estimated_delivery_date
            )
        ELSE NULL
    END as tracking
FROM orders o
JOIN products p ON p.id = o.product_id
JOIN collections c ON c.id = o.collection_id
LEFT JOIN collection_access ca ON ca.collection_id = c.id AND ca.user_id = auth.uid()
LEFT JOIN order_tracking t ON t.order_id = o.id
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
GRANT SELECT ON merchant_orders TO authenticated;

COMMENT ON VIEW merchant_orders IS 'View of orders for merchants and admins, including tracking information';

COMMIT; 