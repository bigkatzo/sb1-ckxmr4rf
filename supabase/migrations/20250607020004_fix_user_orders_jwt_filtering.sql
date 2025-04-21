-- Fix user_orders view to properly filter by JWT wallet address
BEGIN;

-- First make sure the check_wallet_access function exists
CREATE OR REPLACE FUNCTION check_wallet_access(wallet_addr text)
RETURNS boolean AS $$
BEGIN
  -- If there's a wallet_address claim in the JWT, allow direct matching
  IF auth.jwt() ? 'wallet_address' AND auth.jwt()->>'wallet_address' = wallet_addr THEN
    RETURN true;
  END IF;

  -- Also check if the wallet is associated with the current authenticated user
  RETURN EXISTS (
    SELECT 1 
    FROM wallets w 
    WHERE w.user_id = auth.uid() 
    AND w.wallet_address = wallet_addr
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION check_wallet_access TO authenticated;

-- Drop existing view 
DROP VIEW IF EXISTS user_orders CASCADE;

-- Create updated view with proper wallet filtering
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
LEFT JOIN order_tracking ot ON ot.order_id = o.id
-- CRITICAL FIX: Add explicit WHERE clause to filter by wallet address from JWT
WHERE check_wallet_access(o.wallet_address);

-- Add a comment explaining the security approach
COMMENT ON VIEW user_orders IS 'User orders view with explicit wallet address filtering using check_wallet_access() function to ensure data is properly scoped to the connected wallet';

COMMIT; 