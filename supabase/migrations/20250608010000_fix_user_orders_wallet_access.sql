-- Fix user_orders view to use direct JWT claim extraction
BEGIN;

-- Drop existing view
DROP VIEW IF EXISTS user_orders CASCADE;

-- Create updated view with more reliable JWT access
CREATE OR REPLACE VIEW user_orders AS
SELECT 
    o.id,
    o.order_number,
    o.status,
    o.created_at,
    o.updated_at,
    o.product_id,
    o.collection_id,
    o.wallet_address,
    o.transaction_signature,
    o.shipping_address,
    o.contact_info,
    o.amount_sol,
    o.variant_selections,
    o.product_snapshot,
    o.collection_snapshot,
    o.payment_metadata,
    o.category_name,
    -- Product and collection details from joined tables
    COALESCE(p.name, o.product_name) as product_name,
    COALESCE(p.sku, o.product_sku) as product_sku,
    COALESCE(c.name, o.collection_name) as collection_name,
    -- Include tracking as a JSON field
    t as tracking,
    CASE 
        WHEN o.status = 'delivered' THEN true
        WHEN o.status = 'shipped' AND t IS NOT NULL THEN true
        ELSE false
    END as is_trackable
FROM 
    orders o
    LEFT JOIN products p ON p.id = o.product_id
    LEFT JOIN collections c ON c.id = o.collection_id
    LEFT JOIN LATERAL (
        -- Use a subquery for tracking to create a JSON object
        SELECT to_jsonb(ot.*) as t
        FROM order_tracking ot
        WHERE ot.order_id = o.id
        LIMIT 1
    ) t1 ON true  -- Always join this subquery
WHERE 
    -- Direct JWT access for wallet validation
    o.wallet_address = auth.jwt()->>'wallet_address';

-- Grant permissions
GRANT SELECT ON user_orders TO authenticated;

-- Add comment explaining the view
COMMENT ON VIEW user_orders IS 'User orders view that uses direct JWT wallet_address claim for filtering';

COMMIT; 