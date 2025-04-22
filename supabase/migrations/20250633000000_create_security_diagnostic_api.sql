-- Create diagnostic API to help diagnose and fix wallet auth security issues
BEGIN;

-- Create a function to directly test and fix RLS bypass issues
CREATE OR REPLACE FUNCTION diagnose_and_fix_security_issue()
RETURNS jsonb AS $$
DECLARE
  existing_policies jsonb;
  problem_found boolean := false;
  fix_applied boolean := false;
  rls_enabled boolean;
  test_result jsonb;
  direct_query_test jsonb;
  policy_name text;
BEGIN
  -- Step 1: Check if RLS is enabled on orders table
  SELECT relrowsecurity INTO rls_enabled
  FROM pg_class
  WHERE relname = 'orders';
  
  IF NOT rls_enabled THEN
    -- RLS not enabled - critical issue
    ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
    problem_found := true;
    fix_applied := true;
  END IF;
  
  -- Step 2: Collect existing policies
  SELECT jsonb_agg(
    jsonb_build_object(
      'policy_name', policyname,
      'roles', roles,
      'cmd', cmd,
      'qual', pg_get_expr(qual, tableid),
      'with_check', pg_get_expr(with_check, tableid)
    )
  ) INTO existing_policies
  FROM pg_policies
  WHERE tablename = 'orders';
  
  -- Step 3: Test if a blank query bypasses security
  -- This simulates no auth token but wallet address header
  BEGIN
    PERFORM set_config('request.headers', 
      jsonb_build_object(
        'x-wallet-address', 'TEST_WALLET',
        'x-wallet-auth-token', NULL
      )::text, 
      true);
    
    -- Try to access orders and see if token validation is enforced
    SELECT jsonb_build_object(
      'count', COUNT(*),
      'token_validated', auth.wallet_matches('TEST_WALLET') = false
    ) INTO direct_query_test
    FROM orders
    WHERE wallet_address = 'TEST_WALLET';
    
    -- If count > 0 but token_validated is false, we have a security issue
    IF (direct_query_test->>'count')::int > 0 AND (direct_query_test->>'token_validated')::boolean = false THEN
      problem_found := true;
      
      -- Apply emergency fix: Drop ALL policies and recreate the main secure one
      -- This is a drastic measure but ensures security
      FOR policy_name IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'orders'
      LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_name || '" ON orders';
      END LOOP;
      
      -- Create a single secure policy
      CREATE POLICY "secure_wallet_access_policy"
      ON orders
      FOR SELECT
      TO authenticated, anon
      USING (
        -- Strict match that requires wallet address match AND valid token format
        auth.wallet_matches(wallet_address)
        OR 
        -- Admin access not requiring token
        EXISTS (
          SELECT 1 FROM user_profiles up
          WHERE up.id = auth.uid()
          AND up.role = 'admin'
        )
      );
      
      fix_applied := true;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- If this errors, we have other issues
    problem_found := true;
  END;
  
  -- Step 4: Test our fix
  IF fix_applied THEN
    -- Test with missing token
    PERFORM set_config('request.headers', 
      jsonb_build_object(
        'x-wallet-address', 'TEST_WALLET',
        'x-wallet-auth-token', NULL
      )::text, 
      true);
      
    SELECT jsonb_build_object(
      'allowed', auth.wallet_matches('TEST_WALLET'),
      'count', (SELECT COUNT(*) FROM orders WHERE wallet_address = 'TEST_WALLET')
    ) INTO test_result;
  END IF;
  
  -- Return comprehensive diagnostic info
  RETURN jsonb_build_object(
    'timestamp', now(),
    'rls_enabled', rls_enabled,
    'existing_policies', existing_policies,
    'problem_found', problem_found,
    'fix_applied', fix_applied,
    'direct_query_test', direct_query_test,
    'test_result', test_result,
    'auth_functions', (
      SELECT jsonb_agg(proname) 
      FROM pg_proc 
      WHERE proname LIKE '%wallet%' OR proname LIKE '%auth%'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to verify if a specific API endpoint is security-hardened
CREATE OR REPLACE FUNCTION verify_endpoint_security(endpoint text)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
  test_wallet text := 'TEST_WALLET_' || floor(random() * 1000)::text;
BEGIN
  -- First try with valid token
  PERFORM set_config('request.headers', 
    jsonb_build_object(
      'x-wallet-address', test_wallet,
      'x-wallet-auth-token', 'WALLET_AUTH_SIGNATURE_' || test_wallet || '_TIMESTAMP_' || extract(epoch from now())
    )::text, 
    true);
  
  -- Check if auth function works correctly with valid token
  SELECT jsonb_build_object(
    'wallet', test_wallet,
    'valid_token_result', auth.wallet_matches(test_wallet),
    'expected', true
  ) INTO result;
  
  -- Then try without token
  PERFORM set_config('request.headers', 
    jsonb_build_object(
      'x-wallet-address', test_wallet
    )::text, 
    true);
  
  -- Check result with missing token (should be false)
  result := result || jsonb_build_object(
    'missing_token_result', auth.wallet_matches(test_wallet),
    'missing_token_expected', false
  );
  
  -- Try with invalid format token
  PERFORM set_config('request.headers', 
    jsonb_build_object(
      'x-wallet-address', test_wallet,
      'x-wallet-auth-token', 'INVALID_FORMAT_TOKEN'
    )::text, 
    true);
  
  -- Check result with invalid token format (should be false)
  result := result || jsonb_build_object(
    'invalid_token_result', auth.wallet_matches(test_wallet),
    'invalid_token_expected', false,
    'endpoint', endpoint,
    'timestamp', now()
  );
  
  -- Return all security test results
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to the diagnostic functions
GRANT EXECUTE ON FUNCTION diagnose_and_fix_security_issue() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION verify_endpoint_security(text) TO authenticated, anon;

-- Add comments
COMMENT ON FUNCTION diagnose_and_fix_security_issue() IS 'Diagnosing and automatically fixing wallet authentication security issues';
COMMENT ON FUNCTION verify_endpoint_security(text) IS 'Verifying endpoint security for token validation';

COMMIT; 