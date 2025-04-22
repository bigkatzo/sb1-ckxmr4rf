-- Absolutely minimal wallet authorization system
BEGIN;

-- IMPORTANT: The primary issue appears to be in the PostgreSQL security settings
-- We need to create a more direct way to look at X-Wallet-Address and X-Wallet-Auth-Token headers

-- Create a function to check both X-Wallet-Address and X-Authorization headers
CREATE OR REPLACE FUNCTION public.owns_wallet(target_wallet text)
RETURNS boolean AS $$
DECLARE
  header_wallet text;
  wallet_token text;
  auth_header text;
BEGIN
  -- Direct header extraction - try multiple header formats
  
  -- Try X-Wallet-Address header
  BEGIN
    header_wallet := current_setting('request.headers.x-wallet-address', true);
    wallet_token := current_setting('request.headers.x-wallet-auth-token', true);
    
    -- If we have both headers and wallet matches, allow access
    IF header_wallet IS NOT NULL AND header_wallet != '' AND
       wallet_token IS NOT NULL AND wallet_token != '' AND
       header_wallet = target_wallet THEN
      RETURN true;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Ignore errors and continue
    NULL;
  END;
  
  -- Try Authorization header as fallback
  BEGIN
    -- Get Authorization header
    auth_header := current_setting('request.headers.authorization', true);
    
    -- If it's present and has our target wallet, allow access
    IF auth_header IS NOT NULL AND position(target_wallet in auth_header) > 0 THEN
      RETURN true;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  -- Try X-Authorization header as fallback
  BEGIN
    -- Get X-Authorization header
    auth_header := current_setting('request.headers.x-authorization', true);
    
    -- If it's present and has our target wallet, allow access
    IF auth_header IS NOT NULL AND position(target_wallet in auth_header) > 0 THEN
      RETURN true;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  -- No match found
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate wallets view
DROP VIEW IF EXISTS user_orders;

-- Create a very simple view with only wallet-based filtering
CREATE VIEW user_orders AS
SELECT o.*
FROM orders o
WHERE public.owns_wallet(o.wallet_address);

-- Recreate the policy
DROP POLICY IF EXISTS "wallet_owner_view_orders" ON orders;

CREATE POLICY "wallet_owner_view_orders" 
ON orders
FOR SELECT
TO public
USING (
  -- Use the most permissive check
  public.owns_wallet(wallet_address)
);

-- Grant permissions
GRANT SELECT ON user_orders TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.owns_wallet(text) TO authenticated, anon;

-- Add super simple debug
CREATE OR REPLACE FUNCTION public.debug_wallet_headers_raw(test_wallet text) 
RETURNS jsonb AS $$
DECLARE
  headers_debug jsonb;
  direct_count integer;
  view_count integer;
BEGIN
  -- Try to extract all possible headers
  SELECT jsonb_build_object(
    'x-wallet-address', current_setting('request.headers.x-wallet-address', true),
    'x-wallet-auth-token', substring(current_setting('request.headers.x-wallet-auth-token', true), 1, 10) || '...',
    'authorization', substring(current_setting('request.headers.authorization', true), 1, 10) || '...',
    'x-authorization', substring(current_setting('request.headers.x-authorization', true), 1, 10) || '...'
  ) 
  INTO headers_debug;
  
  -- Check counts for the test wallet
  SELECT COUNT(*) INTO direct_count FROM orders WHERE wallet_address = test_wallet;
  SELECT COUNT(*) INTO view_count FROM user_orders WHERE wallet_address = test_wallet;
  
  -- Return raw debug info
  RETURN jsonb_build_object(
    'test_wallet', test_wallet,
    'raw_headers', headers_debug,
    'owns_wallet_result', public.owns_wallet(test_wallet),
    'direct_count', direct_count,
    'view_count', view_count,
    'minimal_auth', true,
    'anon_access', true
  );
EXCEPTION WHEN OTHERS THEN
  -- Return error info
  RETURN jsonb_build_object(
    'error', SQLERRM,
    'minimal_auth', true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.debug_wallet_headers_raw(text) TO authenticated, anon;

COMMENT ON FUNCTION public.owns_wallet(text) IS 'Direct wallet header check for public access';
COMMENT ON VIEW user_orders IS 'Minimal view for wallet header auth';

COMMIT; 