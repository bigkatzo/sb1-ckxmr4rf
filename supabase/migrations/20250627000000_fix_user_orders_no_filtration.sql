-- Fix user_orders view to properly filter by authenticated wallet
BEGIN;

-- Fix the auth.wallet_matches function to properly handle authentication
CREATE OR REPLACE FUNCTION auth.wallet_matches(check_wallet text) 
RETURNS boolean AS $$
DECLARE
  header_wallet text;
  header_token text;
  jwt_wallet text;
  result boolean;
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

  -- Check if either wallet authentication method matches
  result := (header_wallet IS NOT NULL AND header_wallet = check_wallet AND header_token IS NOT NULL) OR 
          (jwt_wallet IS NOT NULL AND jwt_wallet = check_wallet);
  
  -- Log authentication attempt for debugging
  RAISE NOTICE 'Wallet auth check: header_wallet=%, has_token=%, jwt_wallet=%, checking=%, result=%',
    header_wallet, 
    header_token IS NOT NULL,
    jwt_wallet,
    check_wallet,
    result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the user_orders view with proper filtration
DROP VIEW IF EXISTS user_orders CASCADE;

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
  auth.wallet_matches(o.wallet_address);

-- Create a stronger RLS policy that ensures wallet authentication
DROP POLICY IF EXISTS "orders_user_view" ON orders;

CREATE POLICY "orders_user_view"
ON orders
FOR SELECT
TO authenticated, anon
USING (
  auth.wallet_matches(wallet_address)
);

-- Create admin-only function to debug order access
CREATE OR REPLACE FUNCTION admin_debug_user_orders() 
RETURNS TABLE (
  wallet_address text,
  auth_header_wallet text,
  auth_jwt_wallet text,
  order_count bigint,
  matches_function boolean
) AS $$
DECLARE
  auth_header_wallet text;
  auth_jwt_wallet text;
BEGIN
  -- Only allow admins to run this function
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  
  -- Get current auth info
  BEGIN
    auth_header_wallet := current_setting('request.headers.x-wallet-address', true);
  EXCEPTION WHEN OTHERS THEN
    auth_header_wallet := null;
  END;
  
  BEGIN
    auth_jwt_wallet := auth.jwt()->>'wallet_address';
  EXCEPTION WHEN OTHERS THEN
    auth_jwt_wallet := null;
  END;
  
  -- Return debug information for all wallets with orders
  RETURN QUERY
  SELECT 
    o.wallet_address,
    auth_header_wallet,
    auth_jwt_wallet,
    COUNT(o.id),
    auth.wallet_matches(o.wallet_address)
  FROM orders o
  GROUP BY o.wallet_address
  ORDER BY COUNT(o.id) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION admin_debug_user_orders() TO authenticated;

COMMIT; 