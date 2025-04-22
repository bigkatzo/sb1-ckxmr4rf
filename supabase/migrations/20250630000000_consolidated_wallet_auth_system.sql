-- ==========================================
-- WALLET AUTHENTICATION SYSTEM
-- Version: 1.0
-- Last Updated: 2025-06-30
-- ==========================================
BEGIN;

-- ==========================================
-- 1. CORE AUTHENTICATION FUNCTIONS
-- ==========================================

/**
 * auth.get_header_values - Extracts wallet authentication headers from the request
 * 
 * @returns jsonb - Object containing wallet_address, wallet_token, has_token, and jwt_wallet
 * 
 * Example: SELECT auth.get_header_values();
 */
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

/**
 * auth.wallet_matches - Validates if a wallet belongs to the authenticated user
 * 
 * @param check_wallet (text) - The wallet address to validate
 * @returns boolean - True if authenticated for this wallet, false otherwise
 * 
 * Example: SELECT auth.wallet_matches('CP9mCLHEk2j9L6RTndQnHoUkyH8qZeEfTgEDtvqcL3Yn');
 */
CREATE OR REPLACE FUNCTION auth.wallet_matches(check_wallet text) 
RETURNS boolean AS $$
DECLARE
  auth_info jsonb;
  header_wallet text;
  has_token boolean;
  jwt_wallet text;
  result boolean;
BEGIN
  -- Get auth info using the reliable function
  auth_info := auth.get_header_values();
  
  -- Extract values
  header_wallet := auth_info->>'wallet_address';
  has_token := (auth_info->>'has_token')::boolean;
  jwt_wallet := auth_info->>'jwt_wallet';
  
  -- Calculate match result
  result := (header_wallet IS NOT NULL AND header_wallet = check_wallet AND has_token) OR
           (jwt_wallet IS NOT NULL AND jwt_wallet = check_wallet);
  
  -- Log for debugging (can be removed in production)
  RAISE NOTICE 'Wallet auth: header_wallet=%, has_token=%, jwt_wallet=%, check_wallet=%, result=%',
    header_wallet, has_token, jwt_wallet, check_wallet, result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/**
 * auth.debug_wallet_matches - Detailed diagnostic wrapper for wallet_matches
 * 
 * @param check_wallet (text) - The wallet address to check
 * @returns jsonb - Detailed diagnostic information about the authentication attempt
 * 
 * Example: SELECT auth.debug_wallet_matches('CP9mCLHEk2j9L6RTndQnHoUkyH8qZeEfTgEDtvqcL3Yn');
 */
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
    'timestamp', now(),
    'header_match', header_match,
    'jwt_match', jwt_match,
    'auth_info', auth_info,
    'check_wallet', check_wallet,
    'all_headers', pg_catalog.current_setting('request.headers', true)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 2. VIEW DEFINITIONS WITH AUTHENTICATION
-- ==========================================

-- Drop existing view if it exists
DROP VIEW IF EXISTS user_orders CASCADE;

/**
 * user_orders - View that filters orders by wallet authentication
 * Shows only orders belonging to the authenticated wallet
 */
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
  products p ON p.id = o.product_id
LEFT JOIN
  collections c ON c.id = o.collection_id
LEFT JOIN
  order_tracking ot ON ot.order_id = o.id
LEFT JOIN
  categories cat ON cat.id = p.category_id
WHERE 
  auth.wallet_matches(o.wallet_address)
  OR 
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'admin'
  );

-- ==========================================
-- 3. RLS POLICY DEFINITIONS
-- ==========================================

-- Update the orders RLS policy
DROP POLICY IF EXISTS "orders_user_view" ON orders;
DROP POLICY IF EXISTS "orders_user_access" ON orders;
DROP POLICY IF EXISTS "orders_user_direct_access" ON orders;

/**
 * orders_wallet_auth_policy - Policy for orders table to validate wallet auth
 */
CREATE POLICY "orders_wallet_auth_policy"
ON orders
FOR SELECT
TO authenticated, anon
USING (
  -- Allow if wallet matches via header or JWT
  auth.wallet_matches(wallet_address)
  OR
  -- Allow admin access
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'admin'
  )
);

-- Order tracking policies
DROP POLICY IF EXISTS "order_tracking_user_view" ON order_tracking;

/**
 * order_tracking_wallet_auth_policy - Policy for order_tracking table
 */
CREATE POLICY "order_tracking_wallet_auth_policy"
ON order_tracking
FOR SELECT
TO authenticated, anon
USING (
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_id
    AND (
      auth.wallet_matches(o.wallet_address)
      OR 
      EXISTS (
        SELECT 1 FROM user_profiles up
        WHERE up.id = auth.uid()
        AND up.role = 'admin'
      )
    )
  )
);

-- Tracking events policy
DROP POLICY IF EXISTS "tracking_events_user_view" ON tracking_events;

/**
 * tracking_events_wallet_auth_policy - Policy for tracking_events table
 */
CREATE POLICY "tracking_events_wallet_auth_policy"
ON tracking_events
FOR SELECT
TO authenticated, anon
USING (
  EXISTS (
    SELECT 1 
    FROM order_tracking ot
    JOIN orders o ON o.id = ot.order_id
    WHERE ot.id = tracking_id
    AND (
      auth.wallet_matches(o.wallet_address)
      OR 
      EXISTS (
        SELECT 1 FROM user_profiles up
        WHERE up.id = auth.uid()
        AND up.role = 'admin'
      )
    )
  )
);

-- ==========================================
-- 4. DIAGNOSTIC & UTILITY FUNCTIONS
-- ==========================================

/**
 * test_wallet_auth - Tests wallet authentication for a specific wallet
 * 
 * @param wallet_addr (text) - The wallet address to test
 * @returns jsonb - Detailed test results
 * 
 * Example: SELECT test_wallet_auth('CP9mCLHEk2j9L6RTndQnHoUkyH8qZeEfTgEDtvqcL3Yn');
 */
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

/**
 * get_wallet_orders - Securely fetches orders for a wallet with auth checks
 * 
 * @param wallet_addr (text) - The wallet address to get orders for
 * @returns SETOF orders - Set of order records
 * 
 * Example: SELECT * FROM get_wallet_orders('CP9mCLHEk2j9L6RTndQnHoUkyH8qZeEfTgEDtvqcL3Yn');
 */
CREATE OR REPLACE FUNCTION get_wallet_orders(wallet_addr text)
RETURNS SETOF orders AS $$
BEGIN
  -- Check if user is authorized to access this wallet's orders
  IF auth.wallet_matches(wallet_addr) OR
     EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin')
  THEN
    -- Return orders
    RETURN QUERY 
    SELECT * FROM orders
    WHERE wallet_address = wallet_addr
    ORDER BY created_at DESC;
  ELSE
    -- Not authorized
    RAISE EXCEPTION 'Not authorized to access orders for wallet %', wallet_addr;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/**
 * debug_auth_status - Provides comprehensive authentication status information
 * 
 * @returns jsonb - Current authentication status details
 * 
 * Example: SELECT debug_auth_status();
 */
CREATE OR REPLACE FUNCTION debug_auth_status()
RETURNS jsonb AS $$
DECLARE
  auth_info jsonb;
  has_token boolean;
BEGIN
  -- Get current authentication details
  auth_info := auth.get_header_values();
  has_token := (auth_info->>'has_token')::boolean;
  
  -- Return comprehensive debug info
  RETURN jsonb_build_object(
    'headers', auth_info,
    'auth_uid', auth.uid(),
    'auth_role', current_setting('request.jwt.claims', true)::jsonb->>'role',
    'is_admin', EXISTS (
      SELECT 1 FROM user_profiles up 
      WHERE up.id = auth.uid() 
      AND up.role = 'admin'
    ),
    'has_wallet_header', auth_info->>'wallet_address' IS NOT NULL,
    'has_wallet_token', has_token,
    'has_jwt_wallet', auth_info->>'jwt_wallet' IS NOT NULL,
    'timestamp', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/**
 * test_wallet_auth_scenarios - Tests multiple authentication scenarios
 * 
 * @returns TABLE - Table of test scenarios with results
 * 
 * Example: SELECT * FROM test_wallet_auth_scenarios();
 */
CREATE OR REPLACE FUNCTION test_wallet_auth_scenarios()
RETURNS TABLE (scenario text, success boolean, details jsonb) AS $$
DECLARE
  auth_info jsonb;
  test_wallet text;
BEGIN
  -- Get current auth info
  auth_info := auth.get_header_values();
  test_wallet := COALESCE(auth_info->>'wallet_address', auth_info->>'jwt_wallet');
  
  -- Only run specific tests if we have a wallet to test
  IF test_wallet IS NOT NULL THEN
    -- Test correct wallet match
    RETURN QUERY SELECT 
      'Valid wallet match' as scenario,
      auth.wallet_matches(test_wallet),
      jsonb_build_object('wallet', test_wallet, 'auth_info', auth_info);
      
    -- Test invalid wallet match
    RETURN QUERY SELECT 
      'Invalid wallet match' as scenario,
      auth.wallet_matches('Invalid' || test_wallet),
      jsonb_build_object('wallet', 'Invalid' || test_wallet, 'auth_info', auth_info);
  END IF;
  
  -- Always run these generic tests
  RETURN QUERY SELECT 
    'Empty wallet check' as scenario,
    auth.wallet_matches(''),
    jsonb_build_object('wallet', '', 'auth_info', auth_info);
    
  RETURN QUERY SELECT 
    'Null wallet check' as scenario,
    auth.wallet_matches(NULL),
    jsonb_build_object('wallet', NULL, 'auth_info', auth_info);
    
  -- Admin access check
  RETURN QUERY SELECT 
    'Admin access check' as scenario,
    EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin'),
    jsonb_build_object('uid', auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 5. PERFORMANCE OPTIMIZATIONS
-- ==========================================

-- Add optimized indexes for wallet authentication queries
CREATE INDEX IF NOT EXISTS idx_orders_wallet_auth ON orders (wallet_address) 
INCLUDE (status, created_at);

CREATE INDEX IF NOT EXISTS idx_order_tracking_optimized ON order_tracking (order_id)
INCLUDE (tracking_number, status, carrier);

CREATE INDEX IF NOT EXISTS idx_tracking_events_optimized ON tracking_events (tracking_id, timestamp)
INCLUDE (status, details);

-- ==========================================
-- 6. SYSTEM MONITORING VIEW
-- ==========================================

/**
 * auth_system_dashboard - View for monitoring the auth system health
 */
CREATE VIEW auth_system_dashboard AS
SELECT
  (SELECT COUNT(*) FROM pg_proc WHERE proname LIKE 'wallet_matches%' OR proname LIKE 'auth%') as auth_function_count,
  (SELECT COUNT(*) FROM pg_policies WHERE policyname LIKE '%wallet%' OR policyname LIKE '%auth%') as wallet_policies_count,
  (SELECT COUNT(DISTINCT tablename) FROM pg_policies WHERE policyname LIKE '%wallet%' OR policyname LIKE '%auth%') as protected_tables_count,
  (SELECT COUNT(*) FROM pg_views WHERE viewname = 'user_orders') as auth_views_count,
  (SELECT COUNT(*) FROM orders) as total_orders,
  (SELECT COUNT(DISTINCT wallet_address) FROM orders) as unique_wallets,
  now() as last_checked;

-- ==========================================
-- 7. PERMISSIONS
-- ==========================================

-- Grant permissions on functions
GRANT EXECUTE ON FUNCTION auth.get_header_values() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION auth.wallet_matches(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION auth.debug_wallet_matches(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION test_wallet_auth(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_wallet_orders(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION debug_auth_status() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION test_wallet_auth_scenarios() TO authenticated, anon;

-- Grant permissions on views
GRANT SELECT ON user_orders TO authenticated, anon;
GRANT SELECT ON auth_system_dashboard TO authenticated;

-- Grant permissions on tables
GRANT SELECT ON order_tracking TO authenticated, anon;
GRANT SELECT ON tracking_events TO authenticated, anon;

-- Add helpful comments
COMMENT ON FUNCTION auth.wallet_matches IS 'Validates if a wallet belongs to the authenticated user';
COMMENT ON FUNCTION auth.get_header_values IS 'Extracts wallet authentication headers from the request';
COMMENT ON FUNCTION get_wallet_orders IS 'Securely fetches orders for a wallet with proper authentication checks';
COMMENT ON VIEW user_orders IS 'View of orders filtered by wallet authentication';
COMMENT ON VIEW auth_system_dashboard IS 'System dashboard for monitoring authentication system health';

COMMIT; 