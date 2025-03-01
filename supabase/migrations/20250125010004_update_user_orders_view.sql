-- Start transaction
BEGIN;

-- Drop existing view
DROP VIEW IF EXISTS user_orders CASCADE;

-- Create updated view for user's own orders
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
    p.name as product_name,
    c.name as collection_name
FROM orders o
JOIN products p ON p.id = o.product_id
JOIN collections c ON c.id = o.collection_id
WHERE o.wallet_address = auth.jwt()->>'wallet_address';

-- Grant permissions
GRANT SELECT ON user_orders TO authenticated;

COMMIT; 