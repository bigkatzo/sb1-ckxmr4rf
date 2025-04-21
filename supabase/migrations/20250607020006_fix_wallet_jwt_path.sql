-- Fix the JWT claims path to properly access wallet address
BEGIN;

-- Update the check_wallet_access function to look in user.app_metadata.wallet_address
CREATE OR REPLACE FUNCTION check_wallet_access(wallet_addr text)
RETURNS boolean AS $$
DECLARE
  jwt jsonb;
  wallet_from_jwt text;
BEGIN
  -- Get the full JWT 
  jwt := auth.jwt();
  
  -- Try to get wallet address from different possible locations in JWT
  -- First check direct claim
  IF jwt ? 'wallet_address' THEN
    wallet_from_jwt := jwt->>'wallet_address';
    IF wallet_from_jwt = wallet_addr THEN
      RETURN true;
    END IF;
  END IF;
  
  -- Then check user.user_metadata
  IF jwt ? 'user' AND jwt->'user' ? 'user_metadata' AND jwt->'user'->'user_metadata' ? 'wallet_address' THEN
    wallet_from_jwt := jwt->'user'->'user_metadata'->>'wallet_address';
    IF wallet_from_jwt = wallet_addr THEN
      RETURN true;
    END IF;
  END IF;
  
  -- Also check in app_metadata format
  IF jwt ? 'app_metadata' AND jwt->'app_metadata' ? 'wallet_address' THEN
    wallet_from_jwt := jwt->'app_metadata'->>'wallet_address';
    IF wallet_from_jwt = wallet_addr THEN
      RETURN true;
    END IF;
  END IF;
  
  -- Log jwt values for debugging
  RAISE NOTICE 'JWT: %, Wallet: %', jwt, wallet_addr;
  
  -- Skip the wallet association check if the table doesn't exist
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

-- Update the debug_auth_jwt function to show more JWT details for troubleshooting
CREATE OR REPLACE FUNCTION debug_auth_jwt()
RETURNS jsonb AS $$
DECLARE
  jwt jsonb;
  wallet_addr text;
BEGIN
  jwt := auth.jwt();
  
  -- Try multiple paths to find wallet address
  wallet_addr := COALESCE(
    jwt->>'wallet_address',
    jwt->'user'->'user_metadata'->>'wallet_address',
    jwt->'app_metadata'->>'wallet_address'
  );
  
  RETURN jsonb_build_object(
    'uid', auth.uid(),
    'role', auth.role(),
    'jwt_claims', jwt,
    'user_metadata', CASE WHEN jwt ? 'user' THEN jwt->'user'->'user_metadata' ELSE NULL END,
    'app_metadata', CASE WHEN jwt ? 'app_metadata' THEN jwt->'app_metadata' ELSE NULL END,
    'has_wallet_claim', wallet_addr IS NOT NULL,
    'wallet_from_jwt', wallet_addr,
    'check_wallet_fn_result', CASE 
      WHEN wallet_addr IS NOT NULL THEN check_wallet_access(wallet_addr)
      ELSE false
    END,
    'raw_jwt', current_setting('request.jwt.claims', true)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix the user_orders view to use our improved check_wallet_access function 
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
WHERE check_wallet_access(o.wallet_address);

COMMENT ON FUNCTION check_wallet_access(text) IS 'Enhanced function that checks multiple JWT paths for wallet address claims';
COMMENT ON FUNCTION debug_auth_jwt() IS 'Debug function that shows the full JWT structure to troubleshoot access issues';
COMMENT ON VIEW user_orders IS 'User orders view with enhanced JWT checking to properly handle wallet address in different JWT structures';

COMMIT; 