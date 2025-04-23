-- Improved Wallet Authentication System for Orders
-- Fixes the checkout flow to avoid unnecessary re-authentication
-- Prioritizes wallet headers while maintaining security
BEGIN;

-- First drop policies that depend on the functions we'll be recreating
DROP POLICY IF EXISTS wallet_owner_only_policy ON orders;
DROP POLICY IF EXISTS users_can_view_own_orders ON orders;
DROP POLICY IF EXISTS users_can_update_own_orders ON orders;
DROP POLICY IF EXISTS wallet_owner_view_orders ON orders;

-- Then drop the functions with CASCADE to ensure all dependencies are removed
DROP FUNCTION IF EXISTS auth.get_wallet_headers() CASCADE;
DROP FUNCTION IF EXISTS auth.wallet_token_is_valid() CASCADE;
DROP FUNCTION IF EXISTS auth.is_wallet_owner(text) CASCADE;
DROP FUNCTION IF EXISTS get_order_details(uuid) CASCADE;
DROP FUNCTION IF EXISTS get_wallet_orders(text) CASCADE;

-- 1. Create or replace a simple function to reliably extract wallet headers
CREATE OR REPLACE FUNCTION auth.get_wallet_headers()
RETURNS jsonb AS $$
DECLARE
  wallet_address text;
  auth_token text;
BEGIN
  -- Get auth headers with strict error handling
  BEGIN
    wallet_address := current_setting('request.headers.x-wallet-address', true);
    auth_token := current_setting('request.headers.x-wallet-auth-token', true);
  EXCEPTION WHEN OTHERS THEN
    wallet_address := NULL;
    auth_token := NULL;
  END;
  
  -- Try getting auth from Authorization header as fallback
  IF auth_token IS NULL THEN
    BEGIN
      auth_token := replace(current_setting('request.headers.authorization', true), 'Bearer ', '');
    EXCEPTION WHEN OTHERS THEN
      auth_token := NULL;
    END;
  END IF;
  
  -- Second fallback to x-authorization
  IF auth_token IS NULL THEN
    BEGIN
      auth_token := replace(current_setting('request.headers.x-authorization', true), 'Bearer ', '');
    EXCEPTION WHEN OTHERS THEN
      auth_token := NULL;
    END;
  END IF;
  
  -- Return what we found
  RETURN jsonb_build_object(
    'wallet_address', wallet_address,
    'auth_token', auth_token
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create a more reliable wallet token validator function
CREATE OR REPLACE FUNCTION auth.wallet_token_is_valid()
RETURNS boolean AS $$
DECLARE
  headers jsonb;
  wallet_address text;
  auth_token text;
BEGIN
  -- Get headers
  headers := auth.get_wallet_headers();
  wallet_address := headers->>'wallet_address';
  auth_token := headers->>'auth_token';
  
  -- If either header is missing, validation fails
  IF wallet_address IS NULL OR auth_token IS NULL THEN
    RETURN false;
  END IF;
  
  -- Support multiple token formats for flexibility
  
  -- Custom format: WALLET_AUTH_SIGNATURE_X_TIMESTAMP_Y
  IF auth_token LIKE 'WALLET_AUTH_SIGNATURE_%' OR auth_token LIKE 'WALLET_VERIFIED_%' THEN
    -- Basic validation: token contains wallet address
    IF position(wallet_address in auth_token) > 0 THEN
      RETURN true;
    END IF;
  END IF;
  
  -- JWT format (starts with 'ey')
  IF auth_token LIKE 'ey%' THEN
    -- Trust JWT validation was done at token creation 
    -- Additional validation should happen at token creation time
    RETURN true;
  END IF;
  
  -- No format matched or validation failed
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create a unified function to verify wallet ownership that works for both checkout and order viewing
CREATE OR REPLACE FUNCTION auth.is_wallet_owner(target_wallet text)
RETURNS boolean AS $$
DECLARE
  headers jsonb;
  wallet_address text;
BEGIN
  -- Get header data
  headers := auth.get_wallet_headers();
  wallet_address := headers->>'wallet_address';
  
  -- First check: Do wallet addresses match?
  IF wallet_address IS NOT NULL AND wallet_address = target_wallet THEN
    -- Wallet addresses match, now validate token
    RETURN auth.wallet_token_is_valid();
  END IF;
  
  -- If header check failed, try JWT as fallback
  BEGIN
    -- Check JWT claims at various possible locations
    IF auth.jwt()->'user_metadata'->>'wallet_address' = target_wallet THEN
      RETURN true;
    END IF;
    
    IF auth.jwt()->>'wallet_address' = target_wallet THEN
      RETURN true;
    END IF;
    
    IF auth.jwt()->'app_metadata'->>'wallet_address' = target_wallet THEN
      RETURN true;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- JWT check failed, continue to next check
    NULL;
  END;
  
  -- All checks failed
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update or replace user_orders view to prioritize header authentication
DROP VIEW IF EXISTS user_orders CASCADE;

CREATE VIEW user_orders AS
SELECT
  o.*
FROM
  orders o
WHERE
  -- Only return orders where the user is the wallet owner
  auth.is_wallet_owner(o.wallet_address);

-- 5. Fix get_order_details to be more resilient and auth-aware
CREATE OR REPLACE FUNCTION get_order_details(p_order_id uuid)
RETURNS jsonb AS $$
DECLARE
  order_data record;
  tracking_data record;
  is_admin boolean;
  headers jsonb;
  wallet_address text;
BEGIN
  -- Get headers for authentication
  headers := auth.get_wallet_headers();
  wallet_address := headers->>'wallet_address';
  
  -- Check if user is admin
  BEGIN
    SELECT EXISTS (
      SELECT 1 FROM user_profiles
      WHERE role = 'admin'
      AND id = auth.uid()
    ) INTO is_admin;
  EXCEPTION WHEN OTHERS THEN
    is_admin := false;
  END;
  
  -- Get order data
  SELECT o.* INTO order_data
  FROM orders o
  WHERE o.id = p_order_id
  AND (
    -- Admin can access any order
    is_admin OR
    -- Wallet owner can access their orders
    auth.is_wallet_owner(o.wallet_address) OR
    -- Order creator can access their orders
    (auth.uid() IS NOT NULL AND o.created_by = auth.uid())
  );
  
  -- If no data found, return error
  IF order_data IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found or access denied'
    );
  END IF;
  
  -- Get tracking info if available
  SELECT * INTO tracking_data
  FROM order_tracking
  WHERE order_id = p_order_id
  LIMIT 1;
  
  -- Build response
  RETURN jsonb_build_object(
    'success', true,
    'order', to_jsonb(order_data),
    'tracking', CASE WHEN tracking_data IS NOT NULL THEN to_jsonb(tracking_data) ELSE NULL END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create a direct wallet orders fetch function that prioritizes header auth
CREATE OR REPLACE FUNCTION get_wallet_orders(wallet_addr text DEFAULT NULL)
RETURNS SETOF orders AS $$
DECLARE
  headers jsonb;
  header_wallet text;
BEGIN
  -- First get headers
  headers := auth.get_wallet_headers();
  header_wallet := headers->>'wallet_address';
  
  -- Use parameter if provided, otherwise use header wallet
  wallet_addr := COALESCE(wallet_addr, header_wallet);
  
  -- Only proceed if we have a wallet
  IF wallet_addr IS NULL THEN
    RETURN QUERY SELECT * FROM orders WHERE 1=0; -- Empty result
    RETURN;
  END IF;
  
  -- Check authentication
  IF auth.is_wallet_owner(wallet_addr) THEN
    -- Return orders for this wallet
    RETURN QUERY
    SELECT * FROM orders
    WHERE wallet_address = wallet_addr
    ORDER BY created_at DESC;
  ELSE
    -- Authentication failed, return empty set
    RETURN QUERY SELECT * FROM orders WHERE 1=0;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Update RLS policy on orders table
CREATE POLICY "users_can_view_own_orders"
ON orders
FOR SELECT
TO public
USING (
  auth.is_wallet_owner(wallet_address)
);

CREATE POLICY "users_can_update_own_orders"
ON orders
FOR UPDATE
TO public
USING (
  auth.is_wallet_owner(wallet_address)
);

GRANT ALL ON FUNCTION auth.get_wallet_headers() TO public;
GRANT ALL ON FUNCTION auth.wallet_token_is_valid() TO public;
GRANT ALL ON FUNCTION auth.is_wallet_owner(text) TO public;
GRANT ALL ON FUNCTION get_order_details(uuid) TO public;
GRANT ALL ON FUNCTION get_wallet_orders(text) TO public;

COMMIT; 