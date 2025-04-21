-- Fix the check_wallet_access function to handle missing wallets table
BEGIN;

-- Create or replace the function to only check JWT claims if wallets table doesn't exist
CREATE OR REPLACE FUNCTION check_wallet_access(wallet_addr text)
RETURNS boolean AS $$
BEGIN
  -- If there's a wallet_address claim in the JWT, allow direct matching
  -- This is the primary auth method for wallet-based access
  IF auth.jwt() ? 'wallet_address' AND auth.jwt()->>'wallet_address' = wallet_addr THEN
    RETURN true;
  END IF;

  -- Skip the wallet association check if the table doesn't exist
  -- This prevents errors while still enforcing security
  BEGIN
    -- Check if the wallet is associated with the current authenticated user
    RETURN EXISTS (
      SELECT 1 
      FROM pg_tables 
      WHERE schemaname = 'public' AND tablename = 'wallets'
    ) AND EXISTS (
      SELECT 1 
      FROM wallets w 
      WHERE w.user_id = auth.uid() 
      AND w.wallet_address = wallet_addr
    );
  EXCEPTION WHEN undefined_table THEN
    -- If we get here, the table doesn't exist, so only JWT claims are used
    RETURN false;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix the user_orders view to only use JWT wallet claims which is more reliable
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
-- Simplified WHERE clause that doesn't depend on wallets table
WHERE 
    -- If JWT has wallet_address claim, use it for filtering
    (auth.jwt() ? 'wallet_address' AND auth.jwt()->>'wallet_address' = o.wallet_address);

COMMIT; 