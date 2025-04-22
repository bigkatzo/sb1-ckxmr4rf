-- Final fix for user_orders view to handle custom wallet tokens
BEGIN;

-- First, create a more robust function to extract wallet address
CREATE OR REPLACE FUNCTION extract_wallet_from_request()
RETURNS text AS $$
DECLARE
  auth_header text;
  token text;
  jwt_wallet text;
  custom_wallet text;
BEGIN
  -- First try to get from JWT
  BEGIN
    jwt_wallet := auth.jwt()->>'wallet_address';
    IF jwt_wallet IS NOT NULL AND length(jwt_wallet) > 0 THEN
      RETURN jwt_wallet;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Continue with other methods
  END;
  
  -- Try to get from auth header
  BEGIN
    auth_header := current_setting('request.headers', true)::jsonb->'authorization'::text;
    IF auth_header IS NULL OR auth_header = 'null' THEN
      RETURN NULL;
    END IF;
    
    -- Extract token
    token := regexp_replace(auth_header, '^"?Bearer\s+([^\s"]+)"?$', '\1', 'i');
    
    -- Check if it's our custom wallet token
    IF position('WALLET_AUTH_SIGNATURE' in token) > 0 THEN
      -- Parse custom format: WALLET_AUTH_SIGNATURE_{wallet}_TIMESTAMP_{timestamp}_VERIFIED
      custom_wallet := split_part(split_part(token, 'WALLET_AUTH_SIGNATURE_', 2), '_TIMESTAMP_', 1);
      IF custom_wallet IS NOT NULL AND length(custom_wallet) > 10 THEN
        RETURN custom_wallet;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Continue with other methods
  END;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhance the orders RLS policy
-- First drop the existing policy if it exists
DROP POLICY IF EXISTS "orders_extract_wallet_policy" ON orders;

-- Create a new policy
CREATE POLICY "orders_extract_wallet_policy"
ON orders
FOR SELECT
TO authenticated
USING (
  -- Check if this wallet matches the extracted wallet from request
  wallet_address = extract_wallet_from_request() 
  OR
  -- Fallback to JWT direct comparison
  wallet_address = auth.jwt()->>'wallet_address'
);

-- Update the user_orders view to use our enhanced extraction
DROP VIEW IF EXISTS user_orders CASCADE;

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
    ) t1 ON true  -- Always join this subquery
WHERE 
    -- Extract wallet directly from request/context
    o.wallet_address = extract_wallet_from_request();

-- Grant permissions
GRANT SELECT ON user_orders TO authenticated;

-- Add comment explaining the view
COMMENT ON VIEW user_orders IS 'User orders view with custom wallet extraction directly from request';

-- Create a diagnostic function to test our extraction
CREATE OR REPLACE FUNCTION debug_wallet_extraction()
RETURNS jsonb AS $$
DECLARE
  extracted_wallet text;
  auth_header text;
  token text;
BEGIN
  -- Get the extracted wallet
  extracted_wallet := extract_wallet_from_request();
  
  -- Get auth header for reference
  BEGIN
    auth_header := current_setting('request.headers', true)::jsonb->'authorization'::text;
  EXCEPTION WHEN OTHERS THEN
    auth_header := 'error_getting_header';
  END;
  
  -- Extract token
  IF auth_header IS NOT NULL AND auth_header != 'null' THEN
    token := regexp_replace(auth_header, '^"?Bearer\s+([^\s"]+)"?$', '\1', 'i');
  ELSE
    token := NULL;
  END IF;
  
  -- Return all debug info
  RETURN jsonb_build_object(
    'extracted_wallet', extracted_wallet,
    'auth_header_truncated', CASE WHEN auth_header IS NOT NULL THEN substring(auth_header, 1, 20) || '...' ELSE NULL END,
    'token_prefix', CASE WHEN token IS NOT NULL THEN substring(token, 1, 20) || '...' ELSE NULL END,
    'has_signature_marker', CASE WHEN token IS NOT NULL THEN position('WALLET_AUTH_SIGNATURE' in token) > 0 ELSE NULL END,
    'jwt_wallet', auth.jwt()->>'wallet_address',
    'authenticated_userid', auth.uid(),
    'authenticated_role', auth.role()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION debug_wallet_extraction() TO authenticated;

COMMIT; 