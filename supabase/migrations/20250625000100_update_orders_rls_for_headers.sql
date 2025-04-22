-- Update orders RLS policy to better support header-based wallet authentication
BEGIN;

-- Drop existing functions to avoid conflicts
DROP FUNCTION IF EXISTS auth.authenticate_wallet_owner(text);
DROP FUNCTION IF EXISTS debug_wallet_rls(text);

-- First, let's create a universal wallet authentication function
CREATE OR REPLACE FUNCTION auth.authenticate_wallet_owner(wallet_addr text)
RETURNS boolean AS $$
DECLARE
  header_wallet text;
  header_token text;
BEGIN
  -- First check header-based authentication
  BEGIN
    -- Get wallet address and token from headers
    header_wallet := current_setting('request.headers.x-wallet-address', true);
    header_token := current_setting('request.headers.x-wallet-auth-token', true);
    
    -- If we have valid headers and wallet matches, authenticate
    IF header_wallet IS NOT NULL AND header_wallet != '' AND
       header_token IS NOT NULL AND header_token != '' AND
       header_wallet = wallet_addr THEN
      RETURN true;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- If header extraction fails, continue
    NULL;
  END;
  
  -- If header auth failed, try JWT-based authentication
  BEGIN
    -- Try standard user_metadata path
    IF auth.jwt()->'user_metadata'->>'wallet_address' = wallet_addr THEN
      RETURN true;
    END IF;
    
    -- Try root JWT claim
    IF auth.jwt()->>'wallet_address' = wallet_addr THEN
      RETURN true;
    END IF;
    
    -- Try app_metadata path
    IF auth.jwt()->'app_metadata'->>'wallet_address' = wallet_addr THEN
      RETURN true;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- If JWT extraction fails, continue
    NULL;
  END;
  
  -- If we have an authenticated user, check associated wallets
  IF auth.uid() IS NOT NULL THEN
    BEGIN
      -- If wallets table exists, check user association
      IF EXISTS (
        SELECT 1 FROM pg_tables
        WHERE schemaname = 'public' AND tablename = 'wallets'
      ) THEN
        RETURN EXISTS (
          SELECT 1 FROM wallets
          WHERE user_id = auth.uid()
          AND wallet_address = wallet_addr
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Table doesn't exist or other error, continue
      NULL;
    END;
  END IF;
  
  -- All authentication methods failed
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing wallet-related policies
DROP POLICY IF EXISTS "orders_user_view" ON orders;
DROP POLICY IF EXISTS "wallet_owner_view_orders" ON orders;

-- Create new policy for wallet owners to view their orders
CREATE POLICY "wallet_owner_view_orders"
ON orders
FOR SELECT
TO authenticated
USING (
  -- Use our new universal wallet authentication function
  auth.authenticate_wallet_owner(wallet_address)
);

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION auth.authenticate_wallet_owner(text) TO authenticated;

-- Add an RLS policy debugging function
CREATE OR REPLACE FUNCTION debug_wallet_rls(target_wallet text) 
RETURNS jsonb AS $$
DECLARE
  direct_query_result jsonb;
  rls_details jsonb;
BEGIN
  -- Get authentication details
  SELECT 
    jsonb_build_object(
      'header_wallet', COALESCE(current_setting('request.headers.x-wallet-address', true), NULL),
      'header_token_present', current_setting('request.headers.x-wallet-auth-token', true) IS NOT NULL,
      'jwt_available', auth.jwt() IS NOT NULL,
      'jwt_wallet', COALESCE(
        auth.jwt()->'user_metadata'->>'wallet_address',
        auth.jwt()->>'wallet_address',
        auth.jwt()->'app_metadata'->>'wallet_address',
        NULL
      ),
      'authenticated_user', auth.uid(),
      'auth_function_result', auth.authenticate_wallet_owner(target_wallet)
    )
  INTO rls_details;
  
  -- Get direct query result
  SELECT 
    jsonb_build_object(
      'count', COUNT(*),
      'sample', (
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'order_number', o2.order_number,
              'status', o2.status
            )
          ),
          '[]'::jsonb
        )
        FROM (
          SELECT order_number, status
          FROM orders
          WHERE wallet_address = target_wallet
          ORDER BY created_at DESC
          LIMIT 5
        ) o2
      )
    )
  FROM orders o
  WHERE o.wallet_address = target_wallet
  INTO direct_query_result;
  
  -- Return complete debugging info
  RETURN jsonb_build_object(
    'target_wallet', target_wallet,
    'authentication', rls_details,
    'direct_query', direct_query_result,
    'policy_name', 'wallet_owner_view_orders',
    'using_clause', 'auth.authenticate_wallet_owner(wallet_address)'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION debug_wallet_rls(text) TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION auth.authenticate_wallet_owner(text) IS 'Unified wallet authentication function that checks headers, JWT claims, and user associations';
COMMENT ON FUNCTION debug_wallet_rls(text) IS 'Debugging function for wallet-based RLS policies';
COMMENT ON POLICY wallet_owner_view_orders ON orders IS 'Allows wallet owners to view their orders using multiple authentication methods';

COMMIT; 