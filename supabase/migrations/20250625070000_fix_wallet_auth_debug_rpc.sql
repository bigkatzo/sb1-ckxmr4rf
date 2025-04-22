-- Fix the wallet_auth_debug RPC function to ensure proper JSON structure
BEGIN;

-- Drop the existing function
DROP FUNCTION IF EXISTS wallet_auth_debug;

-- Create an improved version of the function with better error handling
CREATE OR REPLACE FUNCTION wallet_auth_debug(wallet_addr text DEFAULT NULL)
RETURNS jsonb AS $$
DECLARE
  header_wallet text;
  header_token text;
  direct_count integer;
  view_count integer;
  order_sample jsonb;
  err_context text;
BEGIN
  -- Log headers
  PERFORM log_request_headers();
  
  -- Get wallet from headers with improved error handling
  BEGIN
    header_wallet := current_setting('request.headers.x-wallet-address', true);
    header_token := current_setting('request.headers.x-wallet-auth-token', true);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS err_context = PG_EXCEPTION_CONTEXT;
    RAISE NOTICE 'Error getting headers: % %', SQLERRM, err_context;
    header_wallet := NULL;
    header_token := NULL;
  END;
  
  -- Use parameter wallet or header wallet
  wallet_addr := COALESCE(wallet_addr, header_wallet);
  
  -- Only proceed if we have a wallet to check
  IF wallet_addr IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No wallet address provided or found in headers',
      'headers_present', header_wallet IS NOT NULL AND header_token IS NOT NULL
    );
  END IF;
  
  -- Count orders directly
  BEGIN
    direct_count := count_wallet_orders(wallet_addr);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS err_context = PG_EXCEPTION_CONTEXT;
    RAISE NOTICE 'Error counting orders: % %', SQLERRM, err_context;
    direct_count := 0;
  END;
  
  -- Count through view with improved error handling
  BEGIN
    EXECUTE 'SELECT COUNT(*) FROM user_orders WHERE wallet_address = $1' 
    INTO view_count
    USING wallet_addr;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS err_context = PG_EXCEPTION_CONTEXT;
    RAISE NOTICE 'Error counting from view: % %', SQLERRM, err_context;
    view_count := 0;
  END;
  
  -- Get sample orders with better error handling
  BEGIN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'order_number', o.order_number,
      'status', o.status::text
    )), '[]'::jsonb)
    FROM (
      SELECT order_number, status
      FROM orders
      WHERE wallet_address = wallet_addr
      ORDER BY created_at DESC
      LIMIT 5
    ) o
    INTO order_sample;
    
    -- Ensure we have valid JSON
    IF order_sample IS NULL THEN
      order_sample := '[]'::jsonb;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS err_context = PG_EXCEPTION_CONTEXT;
    RAISE NOTICE 'Error getting order sample: % %', SQLERRM, err_context;
    order_sample := '[]'::jsonb;
  END;
  
  -- Return final debug info with guaranteed valid JSON structure
  RETURN jsonb_build_object(
    'success', true,
    'wallet_address', wallet_addr,
    'headers_present', header_wallet IS NOT NULL AND header_token IS NOT NULL,
    'wallet_matches_header', wallet_addr = header_wallet,
    'direct_orders_count', direct_count,
    'view_orders_count', view_count,
    'order_sample', order_sample
  );
EXCEPTION WHEN OTHERS THEN
  -- Catch-all exception handler to ensure we always return valid JSON
  GET STACKED DIAGNOSTICS err_context = PG_EXCEPTION_CONTEXT;
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'context', err_context,
    'wallet_address', wallet_addr
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION wallet_auth_debug(text) TO authenticated, anon;

-- Add a helpful comment
COMMENT ON FUNCTION wallet_auth_debug(text) IS 'Debug function for wallet authentication with improved error handling';

COMMIT; 