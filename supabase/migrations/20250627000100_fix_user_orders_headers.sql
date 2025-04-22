-- Fix user_orders view to properly handle header authentication
BEGIN;

-- Create a more reliable function to extract wallet headers
CREATE OR REPLACE FUNCTION auth.get_header_values() 
RETURNS jsonb AS $$
DECLARE
  all_headers jsonb;
  wallet_address text;
  wallet_token text;
BEGIN
  -- Get all request headers as JSON
  BEGIN
    all_headers := current_setting('request.headers', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    all_headers := '{}'::jsonb;
  END;
  
  -- Extract wallet headers using case-insensitive lookups
  IF all_headers ? 'x-wallet-address' THEN
    wallet_address := all_headers->>'x-wallet-address';
  END IF;
  
  IF all_headers ? 'x-wallet-auth-token' THEN
    wallet_token := all_headers->>'x-wallet-auth-token';
  END IF;
  
  -- Return all relevant auth info
  RETURN jsonb_build_object(
    'wallet_address', wallet_address,
    'wallet_token', wallet_token,
    'has_token', wallet_token IS NOT NULL,
    'jwt_wallet', auth.jwt()->>'wallet_address'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update wallet matching function using the reliable header extraction
CREATE OR REPLACE FUNCTION auth.wallet_matches(check_wallet text) 
RETURNS boolean AS $$
DECLARE
  auth_info jsonb;
  header_wallet text;
  has_token boolean;
  jwt_wallet text;
BEGIN
  -- Get auth info using the reliable function
  auth_info := auth.get_header_values();
  
  -- Extract values
  header_wallet := auth_info->>'wallet_address';
  has_token := (auth_info->>'has_token')::boolean;
  jwt_wallet := auth_info->>'jwt_wallet';
  
  -- Log for debugging
  RAISE NOTICE 'Wallet auth: header_wallet=%, has_token=%, jwt_wallet=%, check_wallet=%',
    header_wallet, has_token, jwt_wallet, check_wallet;
  
  -- Return true if either method authenticates this wallet
  RETURN (header_wallet IS NOT NULL AND header_wallet = check_wallet AND has_token) OR
         (jwt_wallet IS NOT NULL AND jwt_wallet = check_wallet);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a special debug-only wrapper around wallet_matches 
-- to help us see exactly why it might not be working
CREATE OR REPLACE FUNCTION auth.debug_wallet_matches(check_wallet text)
RETURNS jsonb AS $$
DECLARE
  auth_info jsonb;
  header_wallet text;
  has_token boolean;
  jwt_wallet text;
  header_match boolean;
  jwt_match boolean;
  result boolean;
BEGIN
  -- Get auth info using the reliable function
  auth_info := auth.get_header_values();
  
  -- Extract values
  header_wallet := auth_info->>'wallet_address';
  has_token := (auth_info->>'has_token')::boolean;
  jwt_wallet := auth_info->>'jwt_wallet';
  
  -- Calculate matches
  header_match := header_wallet IS NOT NULL AND header_wallet = check_wallet AND has_token;
  jwt_match := jwt_wallet IS NOT NULL AND jwt_wallet = check_wallet;
  result := header_match OR jwt_match;
  
  -- Return detailed debug info
  RETURN jsonb_build_object(
    'result', result,
    'header_match', header_match,
    'jwt_match', jwt_match,
    'auth_info', auth_info,
    'check_wallet', check_wallet,
    'all_headers', pg_catalog.current_setting('request.headers', true)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate user_orders view with more reliable header handling
DROP VIEW IF EXISTS user_orders CASCADE;

CREATE VIEW user_orders AS 
SELECT 
  o.*
FROM 
  orders o
WHERE 
  auth.wallet_matches(o.wallet_address)
  OR 
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'admin'
  );

-- Update the orders RLS policy
DROP POLICY IF EXISTS "orders_user_view" ON orders;

CREATE POLICY "orders_user_view"
ON orders
FOR SELECT
TO authenticated, anon
USING (
  auth.wallet_matches(wallet_address)
  OR
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'admin'
  )
);

-- Create a diagnostic RPC function that can be called directly 
CREATE OR REPLACE FUNCTION test_wallet_auth(wallet_addr text) 
RETURNS jsonb AS $$
DECLARE
  debug_result jsonb;
  order_count integer;
  direct_orders jsonb;
BEGIN
  -- Get debug info from our helper function
  debug_result := auth.debug_wallet_matches(wallet_addr);
  
  -- Count orders for this wallet
  SELECT COUNT(*) INTO order_count FROM orders WHERE wallet_address = wallet_addr;
  
  -- Get sample orders for this wallet
  SELECT jsonb_agg(row_to_json(o)) INTO direct_orders
  FROM (
    SELECT id, order_number, wallet_address, status 
    FROM orders 
    WHERE wallet_address = wallet_addr
    LIMIT 3
  ) o;
  
  -- Return all diagnostic info
  RETURN jsonb_build_object(
    'debug_info', debug_result,
    'order_count', order_count,
    'sample_orders', direct_orders,
    'request_time', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION test_wallet_auth(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION auth.get_header_values() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION auth.debug_wallet_matches(text) TO authenticated, anon;
GRANT SELECT ON user_orders TO authenticated, anon;

COMMIT; 