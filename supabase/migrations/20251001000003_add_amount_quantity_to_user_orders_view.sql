-- Migration to add amount and quantity fields to user_orders view
-- This ensures the view includes the new fields that were added to the orders table

CREATE OR REPLACE VIEW user_orders AS 
SELECT 
  o.id,
  o.order_number,
  o.product_id,
  o.collection_id,
  o.wallet_address,
  o.status,
  o.amount_sol,
  o.amount,
  o.quantity,
  o.created_at,
  o.updated_at,
  o.transaction_signature,
  o.shipping_address,
  o.contact_info,
  o.variant_selections,
  o.product_snapshot,
  o.collection_snapshot,
  o.payment_metadata,
  o.product_name,
  o.product_sku,
  o.collection_name,
  o.category_name,
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
  -- Add is_trackable field
  CASE
    WHEN o.status = 'delivered' THEN true
    WHEN o.status = 'shipped' AND ot.id IS NOT NULL THEN true
    ELSE false
  END as is_trackable
FROM 
  orders o
LEFT JOIN
  products p ON p.id = o.product_id
LEFT JOIN
  collections c ON c.id = o.collection_id
LEFT JOIN
  order_tracking ot ON ot.order_id = o.id
LEFT JOIN
  categories cat ON cat.id = p.category_id
WHERE 
  auth.wallet_matches(o.wallet_address)
  OR 
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'admin'
  ); 