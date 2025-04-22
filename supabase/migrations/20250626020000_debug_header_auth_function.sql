-- Create a thorough header authentication diagnostic function
BEGIN;

-- This function will provide step-by-step diagnostics about the header authentication
CREATE OR REPLACE FUNCTION diagnose_header_auth()
RETURNS jsonb AS $$
DECLARE
  raw_headers jsonb;
  wallet_header text;
  token_header text;
  jwt_wallet text;
  is_header_valid boolean;
  orders_count integer;
  view_count integer;
  test_direct_sql text;
  test_view_sql text;
  permissions_check jsonb;
  sql_result record;
BEGIN
  -- Step 1: Capture all headers as raw JSON
  BEGIN
    SELECT current_setting('request.headers')::jsonb INTO raw_headers;
  EXCEPTION WHEN OTHERS THEN
    raw_headers := jsonb_build_object('error', 'Could not access request.headers');
  END;
  
  -- Step 2: Extract specific wallet headers
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
  
  -- Step 3: Check JWT wallet claim for comparison
  BEGIN
    jwt_wallet := auth.jwt()->>'wallet_address';
  EXCEPTION WHEN OTHERS THEN
    jwt_wallet := null;
  END;
  
  -- Step 4: Verify if the token appears valid (basic format check)
  IF token_header IS NOT NULL AND token_header LIKE 'WALLET_VERIFIED_%' THEN
    is_header_valid := true;
  ELSE
    is_header_valid := false;
  END IF;
  
  -- Step 5: Count orders directly with explicit condition
  IF wallet_header IS NOT NULL THEN
    test_direct_sql := format('SELECT COUNT(*) FROM orders WHERE wallet_address = %L', wallet_header);
    EXECUTE test_direct_sql INTO orders_count;
    
    -- Step 6: Test view with explicit condition
    test_view_sql := format('SELECT COUNT(*) FROM user_orders WHERE wallet_address = %L', wallet_header);
    BEGIN
      EXECUTE test_view_sql INTO view_count;
    EXCEPTION WHEN OTHERS THEN
      view_count := -1; -- Error executing view query
    END;
  ELSE
    orders_count := 0;
    view_count := 0;
  END IF;
  
  -- Step 7: Check table permissions
  BEGIN
    EXECUTE 'SELECT COUNT(*) FROM pg_tables WHERE schemaname = ''public'' AND tablename = ''orders''' INTO sql_result;
    IF sql_result.count > 0 THEN
      permissions_check := jsonb_build_object('table_exists', true);
      
      -- Check if the current user can select from orders
      BEGIN
        EXECUTE 'SELECT has_table_privilege(current_user, ''orders'', ''SELECT'')' INTO sql_result;
        permissions_check := permissions_check || jsonb_build_object('can_select', sql_result.has_table_privilege);
      EXCEPTION WHEN OTHERS THEN
        permissions_check := permissions_check || jsonb_build_object('can_select', false, 'error', SQLERRM);
      END;
    ELSE
      permissions_check := jsonb_build_object('table_exists', false);
    END;
  EXCEPTION WHEN OTHERS THEN
    permissions_check := jsonb_build_object('error', SQLERRM);
  END;
  
  -- Step 8: Return comprehensive diagnostic data
  RETURN jsonb_build_object(
    'timestamp', now(),
    'raw_headers_present', raw_headers IS NOT NULL AND raw_headers != '{}'::jsonb,
    'raw_headers_sample', CASE 
                          WHEN raw_headers IS NULL THEN null
                          WHEN raw_headers = '{}'::jsonb THEN '{}'::jsonb
                          ELSE jsonb_build_object(
                             'count', jsonb_object_keys(raw_headers),
                             'sample', jsonb_build_object(
                               'x-wallet-address', raw_headers->'x-wallet-address',
                               'has_auth_token', raw_headers ? 'x-wallet-auth-token'
                             )
                           )
                          END,
    'extracted_headers', jsonb_build_object(
      'wallet_address', wallet_header,
      'auth_token_present', token_header IS NOT NULL,
      'auth_token_format_valid', is_header_valid,
      'auth_token_sample', CASE WHEN token_header IS NULL THEN null 
                               ELSE substring(token_header, 1, 20) || '...' 
                          END
    ),
    'jwt_wallet', jwt_wallet,
    'wallet_matches', CASE WHEN wallet_header IS NOT NULL AND jwt_wallet IS NOT NULL 
                         THEN wallet_header = jwt_wallet
                         ELSE null
                    END,
    'order_counts', jsonb_build_object(
      'direct_query', orders_count,
      'view_query', view_count,
      'direct_sql', test_direct_sql,
      'view_sql', test_view_sql
    ),
    'permissions', permissions_check,
    'roles', jsonb_build_object(
      'current_role', current_user,
      'current_setting_role', current_setting('role', true)
    ),
    'environment', jsonb_build_object(
      'database', current_database(),
      'session_user', session_user,
      'current_schema', current_schema
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users and anonymous
GRANT EXECUTE ON FUNCTION diagnose_header_auth() TO authenticated, anon;

-- Create a more detailed header capture function that explains how to use it
CREATE OR REPLACE FUNCTION capture_full_headers()
RETURNS jsonb AS $$
DECLARE
  headers_json jsonb;
  all_settings record;
BEGIN
  -- Attempt to capture headers from request settings
  BEGIN
    headers_json := current_setting('request.headers')::jsonb;
  EXCEPTION WHEN OTHERS THEN
    headers_json := '{}'::jsonb;
  END;
  
  -- Return helpful information along with any headers found
  RETURN jsonb_build_object(
    'timestamp', now(),
    'raw_headers', headers_json,
    'found_headers', jsonb_object_keys(headers_json),
    'instructions', 'To test header access, use a front-end fetch request with X-Wallet-Address and X-Wallet-Auth-Token headers set. Call this function to see if they are properly received by PostgreSQL.',
    'notes', 'If headers are empty, it may indicate they are not being passed through middleware or Supabase configuration is not set to allow them.',
    'setting_from_header_example', 'Example of how to use: current_setting(''request.headers.x-wallet-address'', true)'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION capture_full_headers() TO authenticated, anon;

COMMENT ON FUNCTION diagnose_header_auth() IS 'Comprehensive diagnostic tool to troubleshoot wallet header-based authentication issues';
COMMENT ON FUNCTION capture_full_headers() IS 'Captures and displays all HTTP headers received by PostgreSQL from the current request';

COMMIT; 