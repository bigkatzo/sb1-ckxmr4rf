-- Update user_orders view to include all required fields
BEGIN;

-- Drop existing view
DROP VIEW IF EXISTS user_orders CASCADE;

-- Create updated view with full product information and correct tracking join
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
    p.name as product_name,
    p.sku as product_sku,
    -- Use category name from categories table if product has a category_id, 
    -- otherwise try to get it from product_snapshot
    COALESCE(
        cat.name,
        (o.product_snapshot->>'category_name')::text
    ) as category_name,
    c.name as collection_name,
    o.variant_selections,
    o.product_snapshot,
    o.collection_snapshot,
    o.payment_metadata,
    -- Include tracking information as a JSON object
    CASE 
        WHEN ot.id IS NOT NULL THEN 
            jsonb_build_object(
                'id', ot.id,
                'order_id', ot.order_id,
                'tracking_number', ot.tracking_number,
                'carrier', ot.carrier,
                'status', ot.status,
                'status_details', ot.status_details,
                'estimated_delivery_date', ot.estimated_delivery_date,
                'last_update', ot.last_update,
                'created_at', ot.created_at,
                'updated_at', ot.updated_at,
                'tracking_events', COALESCE(
                    (
                        SELECT jsonb_agg(
                            jsonb_build_object(
                                'id', te.id,
                                'status', te.status,
                                'details', te.details,
                                'location', te.location,
                                'timestamp', te.timestamp,
                                'created_at', te.created_at
                            )
                            ORDER BY te.timestamp DESC
                        )
                        FROM tracking_events te
                        WHERE te.tracking_id = ot.id
                    ),
                    '[]'::jsonb
                )
            )
        ELSE NULL
    END AS tracking,
    CASE
        WHEN o.status = 'delivered' THEN true
        WHEN o.status = 'shipped' AND ot.id IS NOT NULL THEN true
        ELSE false
    END as is_trackable
FROM orders o
JOIN products p ON p.id = o.product_id
JOIN collections c ON c.id = o.collection_id
LEFT JOIN categories cat ON cat.id = p.category_id
LEFT JOIN order_tracking ot ON ot.order_id = o.id;

-- Add policy to ensure the tracking view works with RLS
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'order_tracking' AND policyname = 'Users can view tracking for their orders'
    ) THEN
        CREATE POLICY "Users can view tracking for their orders"
        ON order_tracking FOR SELECT
        USING (
            EXISTS (
                SELECT 1 FROM orders o
                WHERE o.id = order_id
                AND check_wallet_access(o.wallet_address)
            )
        );
    END IF;
END $$;

-- Add similar policy for tracking_events
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'tracking_events' AND policyname = 'Users can view tracking events for their orders'
    ) THEN
        CREATE POLICY "Users can view tracking events for their orders"
        ON tracking_events FOR SELECT
        USING (
            EXISTS (
                SELECT 1 FROM order_tracking ot
                JOIN orders o ON o.id = ot.order_id
                WHERE ot.id = tracking_id
                AND check_wallet_access(o.wallet_address)
            )
        );
    END IF;
END $$;

-- Grant permissions
GRANT SELECT ON user_orders TO authenticated;
GRANT SELECT ON order_tracking TO authenticated;
GRANT SELECT ON tracking_events TO authenticated;

-- Add documentation
COMMENT ON VIEW user_orders IS 'Enhanced view of orders for the authenticated user''s wallet, including tracking information from the order_tracking table';

COMMIT; 