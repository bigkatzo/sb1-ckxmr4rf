-- Fix orders table RLS to properly enforce token validation
BEGIN;

-- First, we need to check if our RLS policies are actually using the updated auth.wallet_matches function
-- Reconfirm the RLS policies 

-- Drop existing potentially problematic policies
DROP POLICY IF EXISTS "direct_wallet_match_only" ON orders;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON orders;
DROP POLICY IF EXISTS "Enable access for wallet owner" ON orders;
DROP POLICY IF EXISTS "Enable read access for users based on user_id" ON orders;
DROP POLICY IF EXISTS "Enable read access for users by wallet" ON orders;
DROP POLICY IF EXISTS "orders_user_view" ON orders;
DROP POLICY IF EXISTS "orders_count_public_view" ON orders;
DROP POLICY IF EXISTS "orders_wallet_auth_policy" ON orders;
DROP POLICY IF EXISTS "wallet_owner_view_orders" ON orders;
DROP POLICY IF EXISTS "secure_wallet_orders_policy" ON orders;
DROP POLICY IF EXISTS "direct_wallet_filter_policy" ON orders;

-- Create a new RLS policy with stronger token validation
CREATE POLICY "strict_wallet_auth_policy"
ON orders
FOR SELECT
TO authenticated, anon
USING (
  -- Require strict wallet authentication that validates token format
  auth.wallet_matches(wallet_address)
  OR
  -- Allow admin access
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'admin'
  )
);

-- Update the user_orders view to use the strict validation
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
  o.category_name,
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
  -- Add is_trackable field
  CASE
    WHEN o.status = 'delivered' THEN true
    WHEN o.status = 'shipped' AND ot.id IS NOT NULL THEN true
    ELSE false
  END as is_trackable
FROM 
  orders o
LEFT JOIN
  order_tracking ot ON ot.order_id = o.id
WHERE 
  -- Use strict wallet authentication
  auth.wallet_matches(o.wallet_address)
  OR 
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'admin'
  );

-- Create a test function to verify access with different tokens
CREATE OR REPLACE FUNCTION test_wallet_token_validation(wallet_addr text, token_type text)
RETURNS jsonb AS $$
DECLARE
  all_headers jsonb;
  result jsonb;
BEGIN
  -- Simulate different token scenarios
  CASE token_type
    WHEN 'valid' THEN
      -- Return a valid token
      all_headers := jsonb_build_object(
        'x-wallet-address', wallet_addr,
        'x-wallet-auth-token', 'WALLET_AUTH_SIGNATURE_' || wallet_addr || '_TIMESTAMP_' || extract(epoch from now())
      );
    WHEN 'invalid_format' THEN
      -- Return an invalid format token
      all_headers := jsonb_build_object(
        'x-wallet-address', wallet_addr,
        'x-wallet-auth-token', 'INVALID_TOKEN_FORMAT'
      );
    WHEN 'empty' THEN
      -- Return an empty token
      all_headers := jsonb_build_object(
        'x-wallet-address', wallet_addr,
        'x-wallet-auth-token', ''
      );
    WHEN 'missing' THEN
      -- Return headers without a token
      all_headers := jsonb_build_object(
        'x-wallet-address', wallet_addr
      );
    ELSE
      -- Default case
      all_headers := jsonb_build_object();
  END CASE;
  
  -- Test if the headers would allow access
  PERFORM set_config('request.headers', all_headers::text, true);
  
  -- Get authentication result
  SELECT auth.debug_wallet_matches(wallet_addr) INTO result;
  
  -- Return test results
  RETURN jsonb_build_object(
    'wallet', wallet_addr,
    'token_type', token_type,
    'headers', all_headers,
    'auth_result', result,
    'would_access_be_allowed', result->>'result',
    'timestamp', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add test function execution permission
GRANT EXECUTE ON FUNCTION test_wallet_token_validation(text, text) TO authenticated, anon;

-- Add comments
COMMENT ON POLICY strict_wallet_auth_policy ON orders IS 'Strictly enforces wallet token validation to prevent access without proper authentication';
COMMENT ON FUNCTION test_wallet_token_validation(text, text) IS 'Tests wallet authentication with different token types to verify security';

COMMIT; 