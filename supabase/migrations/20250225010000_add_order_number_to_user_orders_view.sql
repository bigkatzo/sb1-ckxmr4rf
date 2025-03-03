-- Start transaction
BEGIN;

-- Drop existing view
DROP VIEW IF EXISTS user_orders CASCADE;

-- Recreate user orders view with order_number and variants
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
    o.variant_selections as order_variants,
    p.name as product_name,
    p.variants as product_variants,
    p.variant_prices as product_variant_prices,
    p.images as product_images,
    p.sku as product_sku,
    c.name as collection_name
FROM orders o
JOIN products p ON p.id = o.product_id
JOIN collections c ON c.id = o.collection_id;

-- Grant permissions
GRANT SELECT ON user_orders TO authenticated;

COMMIT; 