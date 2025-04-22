/**
 * Advanced PostgreSQL debugging tools for header authentication issues
 */

export const getAdvancedHeaderDebugSQL = () => {
  return `-- ADVANCED HEADER DEBUGGING TOOLKIT
-- Execute this in Supabase SQL Editor to diagnose header authentication issues

-- 1. Create a table to log header information
CREATE TABLE IF NOT EXISTS header_debug_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz DEFAULT now(),
  headers jsonb,
  jwt jsonb,
  request_id text,
  endpoint text
);

-- 2. Create logging function to record headers
CREATE OR REPLACE FUNCTION log_request_headers(endpoint_name text DEFAULT 'unknown')
RETURNS jsonb AS $$
DECLARE
  header_data jsonb;
  auth_header text;
  wallet_header text;
  token_header text;
  request_id text;
  jwt_payload jsonb;
BEGIN
  -- Generate unique request ID
  request_id := gen_random_uuid()::text;
  
  -- Get all headers as jsonb (if available)
  BEGIN
    -- This is Supabase specific - try to get all headers at once
    header_data := current_setting('request.headers', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    header_data := '{}'::jsonb;
  END;
  
  -- Get specific headers
  BEGIN
    auth_header := current_setting('request.headers.authorization', true);
  EXCEPTION WHEN OTHERS THEN
    auth_header := null;
  END;
  
  BEGIN
    wallet_header := current_setting('request.headers.x-wallet-address', true);
  EXCEPTION WHEN OTHERS THEN
    wallet_header := null;
  END;
  
  BEGIN
    token_header := current_setting('request.headers.x-wallet-auth-token', true);
  EXCEPTION WHEN OTHERS THEN
    token_header := null;
  END;
  
  -- Add individual headers to jsonb if missing from bulk headers
  IF header_data = '{}'::jsonb THEN
    header_data := jsonb_build_object();
    
    IF auth_header IS NOT NULL THEN
      header_data := header_data || jsonb_build_object('authorization', auth_header);
    END IF;
    
    IF wallet_header IS NOT NULL THEN
      header_data := header_data || jsonb_build_object('x-wallet-address', wallet_header);
    END IF;
    
    IF token_header IS NOT NULL THEN
      header_data := header_data || jsonb_build_object('x-wallet-auth-token', token_header);
    END IF;
  END IF;
  
  -- Try to extract JWT payload
  BEGIN
    jwt_payload := auth.jwt();
  EXCEPTION WHEN OTHERS THEN
    jwt_payload := '{}'::jsonb;
  END;
  
  -- Log everything
  INSERT INTO header_debug_log (headers, jwt, request_id, endpoint)
  VALUES (header_data, jwt_payload, request_id, endpoint_name);
  
  -- Return diagnostic info
  RETURN jsonb_build_object(
    'request_id', request_id,
    'timestamp', now(),
    'headers_found', jsonb_object_keys(header_data),
    'wallet_address', wallet_header,
    'jwt_wallet', jwt_payload->>'wallet_address',
    'has_auth_token', token_header IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create a function to test header configuration
CREATE OR REPLACE FUNCTION test_header_configuration() 
RETURNS jsonb AS $$
DECLARE
  headers_log jsonb;
  header_wallet text;
  all_config_settings jsonb;
  specific_settings jsonb;
BEGIN
  -- Log headers for this request
  headers_log := log_request_headers('test_header_configuration');
  
  -- Try to get wallet_address from headers
  BEGIN
    header_wallet := current_setting('request.headers.x-wallet-address', true);
  EXCEPTION WHEN OTHERS THEN
    header_wallet := null;
  END;
  
  -- Try to get Postgres configuration settings for request.* namespace
  BEGIN
    WITH settings AS (
      SELECT name, setting, category 
      FROM pg_settings
      WHERE name LIKE 'request.%'
    )
    SELECT jsonb_object_agg(name, setting) INTO specific_settings
    FROM settings;
  EXCEPTION WHEN OTHERS THEN
    specific_settings := '{}'::jsonb;
  END;
  
  -- Test current role and database
  RETURN jsonb_build_object(
    'request_id', headers_log->>'request_id',
    'header_wallet', header_wallet,
    'database', current_database(),
    'role', current_user,
    'header_settings', specific_settings,
    'request_log', (SELECT COUNT(*) FROM header_debug_log),
    'supabase_session', (SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto'))
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create a function to review logged header data
CREATE OR REPLACE FUNCTION review_header_logs(max_records integer DEFAULT 10)
RETURNS jsonb AS $$
DECLARE
  logs jsonb;
BEGIN
  SELECT jsonb_agg(l)
  INTO logs
  FROM (
    SELECT id, timestamp, headers, jwt, request_id, endpoint
    FROM header_debug_log
    ORDER BY timestamp DESC
    LIMIT max_records
  ) l;
  
  RETURN jsonb_build_object(
    'logs', COALESCE(logs, '[]'::jsonb),
    'count', (SELECT COUNT(*) FROM header_debug_log),
    'instructions', 'Call log_request_headers() to log headers for the current request'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create a view that exposes RLS details
CREATE OR REPLACE VIEW rls_policies AS
SELECT
  n.nspname as schema_name,
  c.relname as table_name,
  pol.polname as policy_name,
  CASE 
    WHEN pol.polpermissive THEN 'PERMISSIVE'
    ELSE 'RESTRICTIVE'
  END as policy_type,
  CASE
    WHEN pol.polroles = '{0}' THEN 'PUBLIC'
    ELSE array_to_string(ARRAY(SELECT rolname FROM pg_roles WHERE oid = ANY(pol.polroles)), ', ')
  END as roles,
  CASE pol.polcmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END as command,
  pg_get_expr(pol.polqual, pol.polrelid) as using_expression,
  pg_get_expr(pol.polwithcheck, pol.polrelid) as with_check_expression
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname = 'orders'
ORDER BY schema_name, table_name, policy_name;

-- Grant permissions
GRANT EXECUTE ON FUNCTION log_request_headers(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION test_header_configuration() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION review_header_logs(integer) TO authenticated, anon;
GRANT SELECT ON rls_policies TO authenticated, anon;

-- 6. Create a test endpoint function
CREATE OR REPLACE FUNCTION test_view_with_specific_wallet(test_wallet text)
RETURNS jsonb AS $$
DECLARE
  order_count integer;
  view_order_count integer;
  policy_info jsonb;
BEGIN
  -- Log this request
  PERFORM log_request_headers('test_view_with_specific_wallet');
  
  -- Get direct order count
  EXECUTE 'SELECT COUNT(*) FROM orders WHERE wallet_address = $1'
  INTO order_count
  USING test_wallet;
  
  -- Get view order count
  EXECUTE 'SELECT COUNT(*) FROM user_orders WHERE wallet_address = $1'
  INTO view_order_count
  USING test_wallet;
  
  -- Get policy info for orders table
  SELECT jsonb_agg(r)
  INTO policy_info
  FROM rls_policies r;
  
  -- Return results
  RETURN jsonb_build_object(
    'test_wallet', test_wallet,
    'direct_count', order_count,
    'view_count', view_order_count,
    'policies', policy_info,
    'header_wallet', COALESCE(current_setting('request.headers.x-wallet-address', true), 'none'),
    'has_auth_token', COALESCE(current_setting('request.headers.x-wallet-auth-token', true), 'none') != 'none'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION test_view_with_specific_wallet(text) TO authenticated, anon;
`;
};

/**
 * Export a function to help with using the advanced debug tools
 */
export const getAdvancedDebugInstructions = () => {
  return `
Advanced Header Debugging Tools

This script creates special diagnostic functions to help Supabase administrators
diagnose authentication header issues:

1. Test if headers are reaching PostgreSQL
2. Log header information for analysis
3. Examine RLS policies affecting orders
4. Test direct vs. view access with a specific wallet

After running this script, you can:

1. Call log_request_headers() to log and examine headers
2. Call test_header_configuration() to check header setup
3. Call review_header_logs() to see recent header data
4. Call test_view_with_specific_wallet(wallet_address) with a real wallet address

These tools will help identify exactly where and why header authentication is failing.
`;
};

/**
 * Combined helper to get both SQL and instructions
 */
export const getAdvancedHeaderDebug = () => {
  return {
    sql: getAdvancedHeaderDebugSQL(),
    instructions: getAdvancedDebugInstructions()
  };
};

export default getAdvancedHeaderDebug; 