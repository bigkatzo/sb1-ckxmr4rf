-- Fix user_orders view to properly respect header-based wallet authentication
BEGIN;

-- Create a simplified function to check the wallet address in headers
CREATE OR REPLACE FUNCTION check_wallet_header(check_wallet text)
RETURNS boolean AS $$
DECLARE
  header_wallet text;
  header_token text;
BEGIN
  -- Try to get the wallet address from headers
  BEGIN
    header_wallet := current_setting('request.headers.x-wallet-address', true);
    header_token := current_setting('request.headers.x-wallet-auth-token', true);
  EXCEPTION WHEN OTHERS THEN
    header_wallet := NULL;
    header_token := NULL;
  END;
  
  -- Simple check - if we have both header wallet and token, and wallet matches, allow access
  IF header_wallet IS NOT NULL AND header_token IS NOT NULL AND header_wallet = check_wallet THEN
    RETURN true;
  END IF;
  
  -- Also check JWT for backward compatibility
  BEGIN
    IF check_wallet = auth.jwt()->>'wallet_address' THEN
      RETURN true;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- If JWT check fails, continue
  END;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_wallet_header(text) TO authenticated, anon;

-- Drop and recreate the user_orders view
DROP VIEW IF EXISTS user_orders;

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
  o.category_name,
  -- Use COALESCE with different aliases to avoid column name conflicts
  COALESCE(p.name, o.product_name) as product_display_name,
  COALESCE(o.product_sku, p.sku) as product_display_sku,
  COALESCE(c.name, o.collection_name) as collection_display_name,
  -- Include tracking if exists
  tr.tracking_number,
  tr.carrier,
  tr.status as tracking_status,
  tr.status_details as tracking_details
FROM 
  orders o
LEFT JOIN
  products p ON p.id = o.product_id
LEFT JOIN
  collections c ON c.id = o.collection_id
LEFT JOIN
  order_tracking tr ON tr.order_id = o.id
WHERE
  -- Simple direct check of wallet in headers or JWT
  check_wallet_header(o.wallet_address);

-- Drop and recreate the order policy
DROP POLICY IF EXISTS "orders_user_view" ON orders;

CREATE POLICY "orders_user_view"
ON orders
FOR SELECT
TO authenticated
USING (
  -- Use the same function for consistency
  check_wallet_header(wallet_address)
);

-- Let's also add a debugging function
CREATE OR REPLACE FUNCTION debug_headers_and_jwt()
RETURNS jsonb AS $$
DECLARE
  jwt_wallet text;
  header_wallet text;
  header_token text;
  direct_orders integer;
  view_orders integer;
BEGIN
  -- Get JWT wallet
  BEGIN
    jwt_wallet := auth.jwt()->>'wallet_address';
  EXCEPTION WHEN OTHERS THEN
    jwt_wallet := NULL;
  END;
  
  -- Get headers
  BEGIN
    header_wallet := current_setting('request.headers.x-wallet-address', true);
    header_token := current_setting('request.headers.x-wallet-auth-token', true);
  EXCEPTION WHEN OTHERS THEN
    header_wallet := NULL;
    header_token := NULL;
  END;
  
  -- Count orders
  IF header_wallet IS NOT NULL THEN
    SELECT COUNT(*) INTO direct_orders FROM orders WHERE wallet_address = header_wallet;
    SELECT COUNT(*) INTO view_orders FROM user_orders WHERE wallet_address = header_wallet;
  ELSE
    direct_orders := 0;
    view_orders := 0;
  END IF;
  
  -- Return debug info
  RETURN jsonb_build_object(
    'jwt_wallet', jwt_wallet,
    'header_wallet', header_wallet,
    'has_token', header_token IS NOT NULL,
    'direct_orders', direct_orders,
    'view_orders', view_orders,
    'function_result', CASE WHEN header_wallet IS NOT NULL THEN check_wallet_header(header_wallet) ELSE false END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION debug_headers_and_jwt() TO authenticated, anon;

COMMIT; 