-- Create a diagnostic function to help debug JWT wallet access issues
BEGIN;

-- Function to debug JWT wallet address extraction
CREATE OR REPLACE FUNCTION debug_jwt_wallet_extraction()
RETURNS jsonb AS $$
DECLARE
  jwt_payload jsonb;
  jwt_wallet text;
  direct_method text;
  current_setting_method text;
  wallet_found boolean := false;
BEGIN
  -- Try to get JWT payload
  BEGIN
    jwt_payload := auth.jwt();
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Error extracting JWT payload: ' || SQLERRM,
      'jwt_available', false
    );
  END;
  
  -- Try direct method
  BEGIN
    direct_method := auth.jwt()->>'wallet_address';
    IF direct_method IS NOT NULL THEN
      wallet_found := true;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    direct_method := 'Error: ' || SQLERRM;
  END;
  
  -- Try current_setting method
  BEGIN
    current_setting_method := current_setting('request.jwt.claim.user_metadata.wallet_address', true);
  EXCEPTION WHEN OTHERS THEN
    current_setting_method := 'Error: ' || SQLERRM;
  END;
  
  -- Check user_metadata
  BEGIN
    jwt_wallet := jwt_payload->'user_metadata'->>'wallet_address';
    IF jwt_wallet IS NOT NULL THEN
      wallet_found := true;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    jwt_wallet := 'Error extracting from user_metadata: ' || SQLERRM;
  END;
  
  -- Return all debug information
  RETURN jsonb_build_object(
    'success', wallet_found,
    'jwt_available', jwt_payload IS NOT NULL,
    'direct_method', direct_method,
    'current_setting_method', current_setting_method,
    'user_metadata_wallet', jwt_wallet,
    'jwt_keys', (SELECT jsonb_agg(key) FROM jsonb_object_keys(jwt_payload) AS key),
    'jwt_payload', jwt_payload
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution permissions to authenticated users
GRANT EXECUTE ON FUNCTION debug_jwt_wallet_extraction() TO authenticated;

-- Add comment
COMMENT ON FUNCTION debug_jwt_wallet_extraction IS 'Debug function to help troubleshoot JWT wallet address extraction issues';

-- Create a convenience function to run both JWT extraction debug and wallet check
CREATE OR REPLACE FUNCTION debug_wallet_auth_check(target_wallet text)
RETURNS jsonb AS $$
DECLARE
  jwt_debug jsonb;
  orders_count integer;
  orders_via_rls integer;
  orders_via_view integer;
  wallet_match boolean := false;
BEGIN
  -- Get JWT debug info
  jwt_debug := debug_jwt_wallet_extraction();
  
  -- Count direct orders for this wallet
  SELECT COUNT(*) INTO orders_count
  FROM orders
  WHERE wallet_address = target_wallet;
  
  -- Check if JWT wallet matches target
  IF jwt_debug->'direct_method' = to_jsonb(target_wallet) THEN
    wallet_match := true;
  ELSIF jwt_debug->'user_metadata_wallet' = to_jsonb(target_wallet) THEN
    wallet_match := true;
  END IF;
  
  -- Count orders after RLS (will only return orders for authenticated wallet)
  BEGIN
    SELECT COUNT(*) INTO orders_via_rls
    FROM orders;
  EXCEPTION WHEN OTHERS THEN
    orders_via_rls := -1; -- Error
  END;
  
  -- Count orders via view
  BEGIN
    SELECT COUNT(*) INTO orders_via_view
    FROM user_orders;
  EXCEPTION WHEN OTHERS THEN
    orders_via_view := -1; -- Error
  END;
  
  -- Return aggregated diagnostics
  RETURN jsonb_build_object(
    'jwt_debug', jwt_debug,
    'target_wallet', target_wallet,
    'wallet_match', wallet_match,
    'total_orders_for_wallet', orders_count,
    'orders_via_rls', orders_via_rls,
    'orders_via_view', orders_via_view
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution permissions to authenticated users
GRANT EXECUTE ON FUNCTION debug_wallet_auth_check(text) TO authenticated;

-- Add comment
COMMENT ON FUNCTION debug_wallet_auth_check IS 'Comprehensive debug function for wallet authentication and order access';

COMMIT; 