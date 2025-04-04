-- Drop existing view if it exists
DROP VIEW IF EXISTS user_orders;

-- Recreate the view with tracking information
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
                'tracking_number', ot.tracking_number,
                'carrier', ot.carrier,
                'status', ot.status,
                'status_details', ot.status_details,
                'estimated_delivery_date', ot.estimated_delivery_date,
                'last_update', ot.last_update,
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
    LEFT JOIN order_tracking ot ON ot.order_id = o.id;

-- Grant access to authenticated users
GRANT SELECT ON user_orders TO authenticated;

-- Add comment
COMMENT ON VIEW user_orders IS 'User-facing view of orders with optional tracking information'; 