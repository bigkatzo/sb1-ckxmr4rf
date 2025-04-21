-- Fix the JWT structure parsing to correctly extract wallet_address from user_metadata
BEGIN;

-- Fix the JWT access function that properly handles the actual JWT structure
CREATE OR REPLACE FUNCTION check_wallet_access(wallet_addr text)
RETURNS boolean AS $$
DECLARE
  raw_jwt_text text;
  parsed_jwt jsonb;
  wallet_from_jwt text;
  check_result boolean := false;
BEGIN
  -- Get the raw JWT text first
  raw_jwt_text := current_setting('request.jwt.claims', true);
  
  -- Parse the raw JWT
  parsed_jwt := raw_jwt_text::jsonb;
  
  -- Debug output
  RAISE NOTICE 'Raw JWT: %, Wallet to check: %', raw_jwt_text, wallet_addr;
  
  -- Extract wallet address from various places
  -- First, try direct from user_metadata in the JWT 
  IF parsed_jwt ? 'user_metadata' AND 
     parsed_jwt->'user_metadata' ? 'wallet_address' THEN
    wallet_from_jwt := parsed_jwt->'user_metadata'->>'wallet_address';
    RAISE NOTICE 'Found in user_metadata: %', wallet_from_jwt;
    
    IF wallet_from_jwt = wallet_addr THEN
      RETURN true;
    END IF;
  END IF;
  
  -- Also try app_metadata
  IF parsed_jwt ? 'app_metadata' AND 
     parsed_jwt->'app_metadata' ? 'wallet_address' THEN
    wallet_from_jwt := parsed_jwt->'app_metadata'->>'wallet_address';
    RAISE NOTICE 'Found in app_metadata: %', wallet_from_jwt;
    
    IF wallet_from_jwt = wallet_addr THEN
      RETURN true;
    END IF;
  END IF;
  
  -- Direct root claim
  IF parsed_jwt ? 'wallet_address' THEN
    wallet_from_jwt := parsed_jwt->>'wallet_address';
    RAISE NOTICE 'Found in root claims: %', wallet_from_jwt;
    
    IF wallet_from_jwt = wallet_addr THEN
      RETURN true;
    END IF;
  END IF;
  
  -- Skip the wallet association check if the table doesn't exist
  BEGIN
    -- Check if the wallet is associated with the current authenticated user
    check_result := EXISTS (
      SELECT 1 
      FROM pg_tables 
      WHERE schemaname = 'public' AND tablename = 'wallets'
    ) AND EXISTS (
      SELECT 1 
      FROM wallets w 
      WHERE w.user_id = auth.uid() 
      AND w.wallet_address = wallet_addr
    );
    
    IF check_result THEN
      RAISE NOTICE 'Wallet found in wallets table for user';
      RETURN true;
    END IF;
  EXCEPTION WHEN undefined_table THEN
    -- If we get here, the table doesn't exist
    RAISE NOTICE 'Wallets table does not exist';
    RETURN false;
  END;
  
  -- If we got this far, no wallet match found
  RAISE NOTICE 'No wallet match found in any location';
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the debug function to better reflect the JWT structure
CREATE OR REPLACE FUNCTION debug_auth_jwt()
RETURNS jsonb AS $$
DECLARE
  raw_jwt_text text;
  parsed_jwt jsonb;
  wallet_from_metadata text;
BEGIN
  -- Get the raw JWT text first - this is the actual JWT data
  raw_jwt_text := current_setting('request.jwt.claims', true);
  
  -- Parse the JWT 
  parsed_jwt := raw_jwt_text::jsonb;
  
  -- Try to find wallet in user_metadata
  IF parsed_jwt ? 'user_metadata' AND parsed_jwt->'user_metadata' ? 'wallet_address' THEN
    wallet_from_metadata := parsed_jwt->'user_metadata'->>'wallet_address';
  END IF;
  
  RETURN jsonb_build_object(
    'uid', auth.uid(),
    'role', auth.role(),
    'jwt_raw', raw_jwt_text,
    'jwt_parsed', parsed_jwt,
    'user_metadata', parsed_jwt->'user_metadata',
    'app_metadata', parsed_jwt->'app_metadata',
    'wallet_in_user_metadata', wallet_from_metadata,
    'has_wallet_claim', wallet_from_metadata IS NOT NULL,
    'check_wallet_result', CASE 
      WHEN wallet_from_metadata IS NOT NULL THEN check_wallet_access(wallet_from_metadata)
      ELSE false
    END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix the user_orders view to use a more direct wallet lookup
CREATE OR REPLACE VIEW user_orders AS
WITH 
  jwt_data AS (
    SELECT 
      current_setting('request.jwt.claims', true)::jsonb AS jwt,
      (current_setting('request.jwt.claims', true)::jsonb->'user_metadata'->>'wallet_address') AS wallet_address
  )
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
CROSS JOIN jwt_data
WHERE 
    -- Direct comparison with wallet address from JWT user_metadata
    (jwt_data.wallet_address IS NOT NULL AND o.wallet_address = jwt_data.wallet_address);

COMMENT ON FUNCTION check_wallet_access(text) IS 'Enhanced function that correctly parses the JWT structure to find wallet address in user_metadata';
COMMENT ON FUNCTION debug_auth_jwt() IS 'Debug function that provides detailed insight into JWT structure and wallet address location';
COMMENT ON VIEW user_orders IS 'User orders view with direct JWT wallet address extraction from user_metadata';

COMMIT; 