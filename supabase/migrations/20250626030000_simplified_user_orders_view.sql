-- Create a simplified and reliable user_orders view that works with both header and JWT auth
BEGIN;

-- 1. Create a simple wallet auth check function that uses both methods
CREATE OR REPLACE FUNCTION auth.wallet_matches(check_wallet text) 
RETURNS boolean AS $$
DECLARE
  header_wallet text;
  header_token text;
  jwt_wallet text;
BEGIN
  -- Check for wallet in headers (method 1)
  BEGIN
    header_wallet := current_setting('request.headers.x-wallet-address', true);
    header_token := current_setting('request.headers.x-wallet-auth-token', true);
  EXCEPTION 
    WHEN OTHERS THEN 
      header_wallet := null;
      header_token := null;
  END;

  -- Check for wallet in JWT (method 2)
  BEGIN
    jwt_wallet := auth.jwt()->>'wallet_address';
  EXCEPTION 
    WHEN OTHERS THEN
      jwt_wallet := null;
  END;

  -- Log authentication attempt
  RAISE NOTICE 'Auth check: header_wallet=%, has_token=%, jwt_wallet=%, checking=%',
    header_wallet, 
    header_token IS NOT NULL,
    jwt_wallet,
    check_wallet;
  
  -- Allow if wallet matches either method
  RETURN (header_wallet = check_wallet AND header_token IS NOT NULL) OR 
         (jwt_wallet = check_wallet);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION auth.wallet_matches(text) TO authenticated, anon;

-- 2. Create a simplified version of the user_orders view 
DROP VIEW IF EXISTS user_orders CASCADE;

-- Create a bare minimum view that focuses just on working correctly
CREATE VIEW user_orders AS 
SELECT 
  o.id,
  o.order_number,
  o.product_id,
  o.collection_id,
  o.wallet_address,
  o.status,
  o.amount_sol,
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
  o.category_name
FROM 
  orders o
WHERE 
  -- Use our simple but reliable function
  auth.wallet_matches(o.wallet_address);

-- 3. Grant permissions
GRANT SELECT ON user_orders TO authenticated, anon;

-- 4. Create a simplified RLS policy for orders to match
DROP POLICY IF EXISTS "orders_user_view" ON orders;

CREATE POLICY "orders_user_view"
ON orders
FOR SELECT
TO authenticated
USING (
  -- Use the same function for the policy
  auth.wallet_matches(wallet_address)
);

-- 5. Add a test function that checks if the view is working
CREATE OR REPLACE FUNCTION test_user_orders_view() 
RETURNS jsonb AS $$
DECLARE
  header_wallet text;
  jwt_wallet text;
  direct_count integer := 0;
  view_count integer := 0;
  view_query_result jsonb;
  wallet_auth_check boolean;
  test_wallet text;
BEGIN
  -- Get auth info
  BEGIN
    header_wallet := current_setting('request.headers.x-wallet-address', true);
  EXCEPTION WHEN OTHERS THEN
    header_wallet := null;
  END;
  
  BEGIN
    jwt_wallet := auth.jwt()->>'wallet_address';
  EXCEPTION WHEN OTHERS THEN
    jwt_wallet := null;
  END;
  
  -- Test wallet to check
  test_wallet := COALESCE(header_wallet, jwt_wallet);
  
  -- Only proceed if we have a wallet to test
  IF test_wallet IS NOT NULL THEN
    -- Get direct count
    EXECUTE format('SELECT COUNT(*) FROM orders WHERE wallet_address = %L', test_wallet) INTO direct_count;
    
    -- Get view count
    EXECUTE format('SELECT COUNT(*) FROM user_orders WHERE wallet_address = %L', test_wallet) INTO view_count;
    
    -- Test our auth function
    SELECT auth.wallet_matches(test_wallet) INTO wallet_auth_check;
    
    -- Get sample from view
    BEGIN
      EXECUTE format('
        SELECT jsonb_agg(jsonb_build_object(
          ''order_number'', order_number,
          ''status'', status,
          ''wallet_address'', wallet_address
        ))
        FROM (
          SELECT order_number, status, wallet_address
          FROM user_orders
          WHERE wallet_address = %L
          LIMIT 3
        ) sub', test_wallet) INTO view_query_result;
    EXCEPTION WHEN OTHERS THEN
      view_query_result := jsonb_build_object('error', SQLERRM);
    END;
  END IF;
  
  -- Return test results
  RETURN jsonb_build_object(
    'test_wallet', test_wallet,
    'header_wallet', header_wallet,
    'jwt_wallet', jwt_wallet,
    'direct_count', direct_count,
    'view_count', view_count,
    'wallet_auth_check', wallet_auth_check,
    'view_sample', view_query_result,
    'auth_role', current_user,
    'timestamp', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION test_user_orders_view() TO authenticated, anon;

COMMIT; 