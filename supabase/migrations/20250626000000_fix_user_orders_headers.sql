-- Fix user_orders view to properly respect both JWT and header wallet authentication
BEGIN;

-- First check if the auth.get_header_wallet() function exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'get_header_wallet'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')
  ) THEN
    -- Create the function to extract wallet from header
    EXECUTE 'CREATE OR REPLACE FUNCTION auth.get_header_wallet()
    RETURNS text AS $func$
    DECLARE
      wallet_address text;
    BEGIN
      wallet_address := current_setting(''request.headers.x-wallet-address'', true);
      RETURN wallet_address;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER';
    
    EXECUTE 'GRANT EXECUTE ON FUNCTION auth.get_header_wallet() TO authenticated, anon';
  END IF;
END $$;

-- Create a function to validate if the header token is present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'has_wallet_header_token'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')
  ) THEN
    EXECUTE 'CREATE OR REPLACE FUNCTION auth.has_wallet_header_token()
    RETURNS boolean AS $func$
    DECLARE
      auth_token text;
    BEGIN
      auth_token := current_setting(''request.headers.x-wallet-auth-token'', true);
      RETURN auth_token IS NOT NULL AND auth_token != '''';
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER';
    
    EXECUTE 'GRANT EXECUTE ON FUNCTION auth.has_wallet_header_token() TO authenticated, anon';
  END IF;
END $$;

-- Create a combined wallet check function that tries both JWT and headers
CREATE OR REPLACE FUNCTION auth.get_authenticated_wallet(check_wallet text)
RETURNS boolean AS $$
DECLARE
  jwt_wallet text;
  header_wallet text;
  has_header_token boolean;
BEGIN
  -- Get wallet from JWT if available
  BEGIN
    jwt_wallet := auth.jwt()->>'wallet_address';
  EXCEPTION WHEN OTHERS THEN
    jwt_wallet := NULL;
  END;
  
  -- Get wallet from header if available
  BEGIN
    header_wallet := auth.get_header_wallet();
    has_header_token := auth.has_wallet_header_token();
  EXCEPTION WHEN OTHERS THEN
    header_wallet := NULL;
    has_header_token := false;
  END;
  
  -- Check if either method authenticates this wallet
  RETURN (jwt_wallet IS NOT NULL AND jwt_wallet = check_wallet) OR 
         (header_wallet IS NOT NULL AND header_wallet = check_wallet AND has_header_token);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION auth.get_authenticated_wallet(text) TO authenticated, anon;

-- Drop existing view if it exists
DROP VIEW IF EXISTS user_orders;

-- Create the user_orders view with proper security checks
CREATE VIEW user_orders AS 
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
  COALESCE(o.product_name, p.name) as product_name,
  COALESCE(o.product_sku, p.sku) as product_sku,
  COALESCE(o.collection_name, c.name) as collection_name,
  o.category_name,
  -- Include tracking information as a JSON object from any linked tracking
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
FROM 
  orders o
LEFT JOIN
  products p ON p.id = o.product_id
LEFT JOIN
  collections c ON c.id = o.collection_id
LEFT JOIN
  order_tracking ot ON ot.order_id = o.id
WHERE
  -- Combined check with both JWT and header authentication
  auth.get_authenticated_wallet(o.wallet_address);

-- Grant access to the view
GRANT SELECT ON user_orders TO authenticated, anon;

-- Drop the policy if it exists
DROP POLICY IF EXISTS "orders_user_view" ON orders;

-- Create a policy to allow access to orders via both JWT and headers
CREATE POLICY "orders_user_view"
ON orders
FOR SELECT
TO authenticated
USING (
  -- Using our authentication function
  auth.get_authenticated_wallet(wallet_address)
);

-- Create a debug function
CREATE OR REPLACE FUNCTION public.debug_wallet_access()
RETURNS jsonb AS $$
DECLARE
  jwt_wallet text;
  header_wallet text;
  has_token boolean;
  direct_count integer;
  view_count integer;
  test_direct_count integer;
  test_view_count integer;
BEGIN
  -- Get wallet from JWT
  BEGIN
    jwt_wallet := auth.jwt()->>'wallet_address';
  EXCEPTION WHEN OTHERS THEN
    jwt_wallet := NULL;
  END;
  
  -- Get wallet from header
  BEGIN
    header_wallet := auth.get_header_wallet();
    has_token := auth.has_wallet_header_token();
  EXCEPTION WHEN OTHERS THEN
    header_wallet := NULL;
    has_token := false;
  END;
  
  -- Count orders for the wallet we find
  IF jwt_wallet IS NOT NULL THEN
    SELECT COUNT(*) INTO direct_count FROM orders WHERE wallet_address = jwt_wallet;
    SELECT COUNT(*) INTO view_count FROM user_orders WHERE wallet_address = jwt_wallet;
  ELSE
    direct_count := 0;
    view_count := 0;
  END IF;
  
  -- And count for header wallet
  IF header_wallet IS NOT NULL THEN
    SELECT COUNT(*) INTO test_direct_count FROM orders WHERE wallet_address = header_wallet;
    
    -- This test will only work if the header auth is working
    IF has_token THEN
      SELECT COUNT(*) INTO test_view_count FROM user_orders WHERE wallet_address = header_wallet;
    ELSE
      test_view_count := 0;
    END IF;
  ELSE
    test_direct_count := 0;
    test_view_count := 0;
  END IF;
  
  -- Return results
  RETURN jsonb_build_object(
    'jwt_wallet', jwt_wallet,
    'header_wallet', header_wallet,
    'has_wallet_token', has_token,
    'wallet_match', CASE WHEN jwt_wallet IS NOT NULL AND header_wallet IS NOT NULL THEN jwt_wallet = header_wallet ELSE NULL END,
    'jwt_direct_orders', direct_count,
    'jwt_view_orders', view_count,
    'header_direct_orders', test_direct_count,
    'header_view_orders', test_view_count,
    'auth_function_for_jwt', CASE WHEN jwt_wallet IS NOT NULL THEN auth.get_authenticated_wallet(jwt_wallet) ELSE NULL END,
    'auth_function_for_header', CASE WHEN header_wallet IS NOT NULL THEN auth.get_authenticated_wallet(header_wallet) ELSE NULL END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.debug_wallet_access() TO authenticated, anon;

COMMIT; 