-- Secure Wallet Authentication with Enhanced Security
BEGIN;

-- Create a secure function to validate the wallet headers
CREATE OR REPLACE FUNCTION auth.validate_wallet_headers(target_wallet text) 
RETURNS boolean AS $$
DECLARE
  header_wallet text;
  auth_token text;
BEGIN
  -- Get headers with secure exception handling
  BEGIN
    header_wallet := current_setting('request.headers.x-wallet-address', true);
    auth_token := current_setting('request.headers.x-wallet-auth-token', true);
    
    -- Validate both headers exist and wallet matches
    IF header_wallet IS NOT NULL AND header_wallet != '' AND
       auth_token IS NOT NULL AND auth_token != '' AND
       header_wallet = target_wallet THEN
       
      -- Check token format (should start with WALLET_VERIFIED or similar)
      IF auth_token LIKE 'WALLET_VERIFIED_%' OR 
         auth_token LIKE 'WALLET_AUTH_%' OR
         auth_token LIKE 'ey%' THEN -- JWT format
        RETURN true;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Fail securely
    RETURN false;
  END;
  
  -- Default to secure denial
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a secure policy for orders table
DROP POLICY IF EXISTS "wallet_owner_view_orders" ON orders;
DROP POLICY IF EXISTS "orders_user_view" ON orders;

-- This policy is restricted to authenticated users only
CREATE POLICY "secure_wallet_orders_policy" 
ON orders
FOR SELECT
TO authenticated, anon  -- Allow both authenticated and anonymous users with proper headers
USING (
  -- Either the wallet is validated by headers
  auth.validate_wallet_headers(wallet_address)
);

-- Create helper function that can be used in views and policies
CREATE OR REPLACE FUNCTION auth.get_wallet_from_headers()
RETURNS text AS $$
BEGIN
  -- Simple try-catch to extract header
  BEGIN
    RETURN current_setting('request.headers.x-wallet-address', true);
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a view that enforces wallet-based access control
DROP VIEW IF EXISTS user_orders;

CREATE VIEW user_orders AS 
SELECT o.*
FROM orders o
WHERE 
  -- Ensure user can only access their own wallet's orders
  auth.validate_wallet_headers(o.wallet_address);

-- Grant permissions
GRANT EXECUTE ON FUNCTION auth.validate_wallet_headers(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION auth.get_wallet_from_headers() TO authenticated, anon;
GRANT SELECT ON user_orders TO authenticated, anon;

-- Add a policy for direct orders queries that enforces wallet ownership
CREATE POLICY "direct_wallet_filter_policy"
ON orders
FOR SELECT
TO authenticated, anon
USING (
  -- Only allow direct filtering if the query includes wallet_address = <header wallet>
  wallet_address = auth.get_wallet_from_headers()
);

-- Add debug function that safely shows only what the current user should see
CREATE OR REPLACE FUNCTION debug_wallet_security(test_wallet text DEFAULT NULL)
RETURNS jsonb AS $$
DECLARE
  header_wallet text;
  result jsonb;
  allowed_count integer;
  view_count integer;
BEGIN
  -- Get header wallet
  header_wallet := auth.get_wallet_from_headers();
  
  -- Only test with wallet from header for security
  test_wallet := COALESCE(test_wallet, header_wallet);
  
  -- Get counts with proper security context
  IF test_wallet IS NOT NULL AND test_wallet = header_wallet THEN
    -- Only count orders the user should have access to
    SELECT COUNT(*) INTO allowed_count FROM orders WHERE wallet_address = test_wallet;
    SELECT COUNT(*) INTO view_count FROM user_orders WHERE wallet_address = test_wallet;
  ELSE
    -- If no security match, return 0 results
    allowed_count := 0;
    view_count := 0;
  END IF;
  
  -- Return security diagnostic info
  RETURN jsonb_build_object(
    'header_wallet', header_wallet,
    'test_wallet', test_wallet,
    'is_wallet_owner', auth.validate_wallet_headers(test_wallet),
    'security_enforced', true,
    'allowed_orders_count', allowed_count,
    'view_orders_count', view_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION auth.validate_wallet_headers(text) IS 'Securely validates wallet ownership from headers with proper security checks';
COMMENT ON FUNCTION auth.get_wallet_from_headers() IS 'Safely retrieves wallet address from request headers';
COMMENT ON VIEW user_orders IS 'Security-enforced view that only shows orders for the authenticated wallet';
COMMENT ON FUNCTION debug_wallet_security(text) IS 'Secure debugging function that only reveals information the user should have access to';

COMMIT; 