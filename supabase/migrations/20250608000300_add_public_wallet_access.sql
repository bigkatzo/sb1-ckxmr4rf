-- Add public access policy for wallet owners to view their own orders without JWT auth
BEGIN;

-- Create a function that safely extracts wallet address from query params
CREATE OR REPLACE FUNCTION get_request_wallet()
RETURNS text AS $$
DECLARE
  wallet_param text;
BEGIN
  -- Try to get wallet address from request.headers['x-wallet-address']
  BEGIN
    wallet_param := current_setting('request.headers', true)::json->>'x-wallet-address';
    IF wallet_param IS NOT NULL AND wallet_param != '' THEN
      RETURN wallet_param;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Ignore errors and continue to next method
    NULL;
  END;
  
  -- Try to get from query string parameter
  BEGIN
    wallet_param := current_setting('request.query.wallet', true);
    IF wallet_param IS NOT NULL AND wallet_param != '' THEN
      RETURN wallet_param;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Ignore errors
    NULL;
  END;
  
  -- If we got here, no wallet in request
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add a policy for public access to orders via wallet address
DROP POLICY IF EXISTS "public_wallet_orders_view" ON orders;

CREATE POLICY "public_wallet_orders_view"
ON orders
FOR SELECT
TO anon, authenticated
USING (
  -- Allow access when wallet address matches request wallet
  wallet_address = get_request_wallet() AND
  -- Basic validation to prevent SQL injection or empty strings
  get_request_wallet() IS NOT NULL AND
  length(get_request_wallet()) > 20
);

-- Create a version of the user_orders view that works with public access
DROP VIEW IF EXISTS public_wallet_orders CASCADE;

CREATE OR REPLACE VIEW public_wallet_orders AS
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
WHERE o.wallet_address = get_request_wallet();

-- Grant permissions so public users can access the view
GRANT SELECT ON public_wallet_orders TO anon;
GRANT SELECT ON public_wallet_orders TO authenticated;
GRANT EXECUTE ON FUNCTION get_request_wallet() TO anon, authenticated;

-- Add comments
COMMENT ON FUNCTION get_request_wallet() IS 'Extracts wallet address from request headers or query parameters';
COMMENT ON POLICY public_wallet_orders_view ON orders IS 'Allows public users to access only orders with matching wallet address';
COMMENT ON VIEW public_wallet_orders IS 'Public access view showing orders for a specific wallet address without requiring authentication';

COMMIT; 