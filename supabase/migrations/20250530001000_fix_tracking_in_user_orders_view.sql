-- Fix the user_orders view to include tracking information
BEGIN;

-- Drop existing view
DROP VIEW IF EXISTS user_orders CASCADE;

-- Recreate user orders view with proper tracking information
-- This maintains the same structure as the current view but ensures
-- the LEFT JOIN with order_tracking is properly implemented
CREATE OR REPLACE VIEW user_orders AS
SELECT 
    o.id,
    o.created_at,
    o.updated_at,
    o.collection_id,
    o.wallet_address,
    o.shipping_address,
    o.contact_info,
    o.status,
    o.amount_sol,
    o.transaction_signature,
    o.product_id,
    o.variant_selections,
    o.order_number,
    o.product_name,
    o.product_sku,
    o.collection_name,
    o.category_name,
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
                'events', COALESCE(
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
    END AS tracking
FROM 
    orders o
    LEFT JOIN order_tracking ot ON ot.order_id = o.id
WHERE 
    -- Filter by wallet address from JWT
    o.wallet_address = auth.jwt()->>'wallet_address';

-- Grant access to authenticated users
GRANT SELECT ON user_orders TO authenticated;

-- Add a policy to ensure the tracking view works with RLS
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
                AND o.wallet_address = auth.jwt()->>'wallet_address'
            )
        );
    END IF;
END $$;

-- Add comment
COMMENT ON VIEW user_orders IS 'User-facing view of orders with optional tracking information from order_tracking table';

COMMIT; 