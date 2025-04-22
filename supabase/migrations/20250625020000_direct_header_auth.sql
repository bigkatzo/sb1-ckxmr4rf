-- Direct solution for wallet header authentication
BEGIN;

-- 1. Create a function to extract wallet address from X-Wallet-Address header
CREATE OR REPLACE FUNCTION auth.get_header_wallet()
RETURNS text AS $$
DECLARE
  wallet_address text;
BEGIN
  -- Simple extraction with no error handling for cleaner code
  wallet_address := current_setting('request.headers.x-wallet-address', true);
  RETURN wallet_address;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create a function to validate if the header token is present
CREATE OR REPLACE FUNCTION auth.has_wallet_header_token()
RETURNS boolean AS $$
DECLARE
  auth_token text;
BEGIN
  -- Get the auth token
  auth_token := current_setting('request.headers.x-wallet-auth-token', true);
  
  -- Return true if token exists and isn't empty
  RETURN auth_token IS NOT NULL AND auth_token != '';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create a simple direct authentication check
CREATE OR REPLACE FUNCTION auth.is_wallet_owner(wallet_addr text)
RETURNS boolean AS $$
BEGIN
  -- If header wallet matches and token exists, allow access
  IF auth.get_header_wallet() = wallet_addr AND auth.has_wallet_header_token() THEN
    RETURN true;
  END IF;
  
  -- Otherwise deny
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create a simplified version of the user_orders view 
DROP VIEW IF EXISTS user_orders;

CREATE VIEW user_orders AS 
SELECT
  -- Select specific columns from orders to avoid conflicts
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
  -- Computed columns with explicit aliases
  COALESCE(p.name, o.product_name) as display_product_name,
  COALESCE(p.sku, o.product_sku) as display_product_sku,
  COALESCE(c.name, o.collection_name) as display_collection_name,
  CASE
    WHEN o.status = 'delivered' THEN true
    WHEN o.status = 'shipped' THEN true
    ELSE false
  END as is_trackable
FROM
  orders o
LEFT JOIN
  products p ON p.id = o.product_id
LEFT JOIN
  collections c ON c.id = o.collection_id
WHERE
  -- Allow if wallet address in header matches and token exists
  auth.is_wallet_owner(o.wallet_address);

-- 5. Create a simpler RLS policy for the orders table
DROP POLICY IF EXISTS "wallet_owner_view_orders" ON orders;

CREATE POLICY "wallet_owner_view_orders" 
ON orders
FOR SELECT
TO authenticated
USING (
  -- Using our simple wallet ownership check
  auth.is_wallet_owner(wallet_address)
);

-- 6. Grant permissions
GRANT EXECUTE ON FUNCTION auth.get_header_wallet() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION auth.has_wallet_header_token() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION auth.is_wallet_owner(text) TO authenticated, anon;
GRANT SELECT ON user_orders TO authenticated, anon;

-- 7. Add helpful debug function
CREATE OR REPLACE FUNCTION public.debug_wallet_auth() 
RETURNS jsonb AS $$
DECLARE
  result jsonb;
  header_wallet text;
  token_present boolean;
  direct_count integer;
  view_count integer;
BEGIN
  -- Get header info
  header_wallet := auth.get_header_wallet();
  token_present := auth.has_wallet_header_token();
  
  -- Check direct orders access (if we have a wallet)
  IF header_wallet IS NOT NULL THEN
    SELECT COUNT(*) INTO direct_count FROM orders WHERE wallet_address = header_wallet;
    SELECT COUNT(*) INTO view_count FROM user_orders WHERE wallet_address = header_wallet;
  ELSE
    direct_count := 0;
    view_count := 0;
  END IF;
  
  -- Build result
  result := jsonb_build_object(
    'header_wallet', header_wallet,
    'wallet_auth_token_present', token_present,
    'is_wallet_owner_result', CASE WHEN header_wallet IS NOT NULL THEN auth.is_wallet_owner(header_wallet) ELSE false END,
    'direct_orders_count', direct_count,
    'view_orders_count', view_count,
    'headers_only_auth', true
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.debug_wallet_auth() TO authenticated, anon;

COMMIT; 