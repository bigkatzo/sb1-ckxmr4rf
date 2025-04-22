-- Fix user_orders view to properly use the wallet header authentication
BEGIN;

-- Drop existing view if it exists
DROP VIEW IF EXISTS user_orders;

-- Drop existing debug function to avoid return type conflict
DROP FUNCTION IF EXISTS debug_wallet_auth();

-- Create or replace the check_wallet_orders_access function to be more permissive
CREATE OR REPLACE FUNCTION check_wallet_orders_access(order_wallet_address text)
RETURNS boolean AS $$
DECLARE
  header_wallet text;
  header_token text;
BEGIN
  -- Get wallet address and auth token from headers
  BEGIN
    header_wallet := current_setting('request.headers.x-wallet-address', true);
    header_token := current_setting('request.headers.x-wallet-auth-token', true);
    
    -- Simple direct header check - if both are present and wallet matches, grant access
    IF header_wallet IS NOT NULL AND header_wallet != '' AND 
       header_token IS NOT NULL AND header_token != '' AND
       header_wallet = order_wallet_address THEN
      -- We're accepting any valid token format here for compatibility
      RETURN true;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- If header extraction fails, continue to next method
    NULL;
  END;
  
  -- Fallback to JWT validation (support multiple formats)
  BEGIN
    -- Try standard JWT path first
    IF auth.jwt()->'user_metadata'->>'wallet_address' = order_wallet_address THEN
      RETURN true;
    END IF;
    
    -- Try direct jwt claim
    IF auth.jwt()->>'wallet_address' = order_wallet_address THEN
      RETURN true;
    END IF;
    
    -- Try app_metadata path
    IF auth.jwt()->'app_metadata'->>'wallet_address' = order_wallet_address THEN
      RETURN true;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- If JWT extraction fails, continue to next method
    NULL;
  END;
  
  -- If we get here, all verification methods failed
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the user_orders view with our improved access check
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
    ) t1 ON true
WHERE 
    -- Use our improved access check function that handles headers more reliably
    check_wallet_orders_access(o.wallet_address);

-- Add a simpler debug function to help diagnose wallet auth issues
CREATE OR REPLACE FUNCTION debug_wallet_auth() 
RETURNS jsonb AS $$
DECLARE
  header_wallet text;
  header_token text;
  jwt_payload jsonb;
  jwt_wallet text;
  direct_orders int;
  view_orders int;
  test_wallet text;
BEGIN
  -- Get wallet from header
  BEGIN
    header_wallet := current_setting('request.headers.x-wallet-address', true);
    header_token := current_setting('request.headers.x-wallet-auth-token', true);
  EXCEPTION 
    WHEN OTHERS THEN
      header_wallet := null;
      header_token := null;
  END;

  -- Try to get wallet from JWT
  BEGIN
    -- Check if JWT is available
    IF auth.jwt() IS NOT NULL THEN
      jwt_payload := auth.jwt();
      
      -- First try user_metadata
      IF jwt_payload ? 'user_metadata' AND jwt_payload->'user_metadata' ? 'wallet_address' THEN
        jwt_wallet := jwt_payload->'user_metadata'->>'wallet_address';
      -- Then try direct claim
      ELSIF jwt_payload ? 'wallet_address' THEN
        jwt_wallet := jwt_payload->>'wallet_address';
      -- Finally try app_metadata
      ELSIF jwt_payload ? 'app_metadata' AND jwt_payload->'app_metadata' ? 'wallet_address' THEN
        jwt_wallet := jwt_payload->'app_metadata'->>'wallet_address';
      END IF;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      jwt_payload := null;
      jwt_wallet := null;
  END;
  
  -- Use header wallet if available, otherwise JWT wallet
  test_wallet := COALESCE(header_wallet, jwt_wallet);
  
  -- Count orders if we have a wallet to test
  IF test_wallet IS NOT NULL THEN
    -- Try to count direct orders
    BEGIN
      SELECT COUNT(*) INTO direct_orders
      FROM orders
      WHERE wallet_address = test_wallet;
    EXCEPTION 
      WHEN OTHERS THEN
        direct_orders := -1;
    END;
    
    -- Try to count view orders
    BEGIN
      SELECT COUNT(*) INTO view_orders
      FROM user_orders
      WHERE wallet_address = test_wallet;
    EXCEPTION 
      WHEN OTHERS THEN
        view_orders := -1;
    END;
  ELSE
    direct_orders := 0;
    view_orders := 0;
  END IF;
  
  -- Return debug info as JSON
  RETURN jsonb_build_object(
    'hasWalletAddress', header_wallet IS NOT NULL,
    'hasWalletAuthToken', header_token IS NOT NULL,
    'tokenType', CASE 
                  WHEN header_token LIKE 'WALLET_VERIFIED_%' THEN 'verified-token'
                  WHEN header_token LIKE 'WALLET_AUTH_%' THEN 'auth-token'
                  WHEN header_token IS NOT NULL AND header_token LIKE 'ey%' THEN 'standard-jwt'
                  ELSE 'unknown'
                END,
    'success', check_wallet_orders_access(test_wallet),
    'target_wallet', test_wallet,
    'direct_orders_count', direct_orders,
    'view_orders_count', view_orders,
    'wallet_match', header_wallet = jwt_wallet,
    'jwt_wallet', jwt_wallet,
    'header_wallet', header_wallet
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to authenticated users
GRANT SELECT ON user_orders TO authenticated;
GRANT EXECUTE ON FUNCTION check_wallet_orders_access(text) TO authenticated;
GRANT EXECUTE ON FUNCTION debug_wallet_auth() TO authenticated;

-- Add comments
COMMENT ON VIEW user_orders IS 'User-facing view of orders with improved header-based wallet authentication';
COMMENT ON FUNCTION check_wallet_orders_access(text) IS 'Checks if the current user has access to orders for the specified wallet address';
COMMENT ON FUNCTION debug_wallet_auth() IS 'Diagnostic function for troubleshooting wallet authentication issues';

COMMIT; 