-- Fix wallet headers debug functions and make headers more accessible
BEGIN;

-- Create a simple storage function that logs headers in table form for debugging
CREATE TABLE IF NOT EXISTS request_headers_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  headers jsonb,
  wallet_address text,
  auth_token text
);

-- Function to store headers that's easier to debug
CREATE OR REPLACE FUNCTION log_request_headers()
RETURNS jsonb AS $$
DECLARE
  wallet_address text;
  auth_token text;
  all_headers jsonb;
BEGIN
  -- Get as many headers as possible
  BEGIN
    SELECT current_setting('request.headers')::jsonb INTO all_headers;
  EXCEPTION WHEN OTHERS THEN
    all_headers := '{}'::jsonb;
  END;
  
  -- Get specific wallet headers
  BEGIN
    wallet_address := all_headers->>'x-wallet-address';
  EXCEPTION WHEN OTHERS THEN
    wallet_address := NULL;
  END;
  
  BEGIN
    auth_token := all_headers->>'x-wallet-auth-token';
  EXCEPTION WHEN OTHERS THEN
    auth_token := NULL;
  END;
  
  -- If we didn't get them from the jsonb approach, try direct setting
  IF wallet_address IS NULL THEN
    BEGIN
      wallet_address := current_setting('request.headers.x-wallet-address', true);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  
  IF auth_token IS NULL THEN
    BEGIN
      auth_token := current_setting('request.headers.x-wallet-auth-token', true);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  
  -- Insert into headers log table for debugging
  INSERT INTO request_headers_log (headers, wallet_address, auth_token)
  VALUES (all_headers, wallet_address, auth_token);
  
  -- Return current headers info
  RETURN jsonb_build_object(
    'headers', all_headers,
    'wallet_address', wallet_address,
    'auth_token', CASE WHEN auth_token IS NOT NULL THEN substring(auth_token, 1, 10) || '...' ELSE NULL END,
    'timestamp', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a super simple function that checks headers and returns wallet orders
CREATE OR REPLACE FUNCTION get_wallet_orders_direct(wallet_addr text)
RETURNS TABLE (
  id uuid,
  order_number text,
  status text,
  wallet_address text,
  created_at timestamptz
) AS $$
BEGIN
  -- Log the headers first
  PERFORM log_request_headers();
  
  -- Return orders directly for the wallet address
  RETURN QUERY
  SELECT 
    o.id,
    o.order_number,
    o.status,
    o.wallet_address,
    o.created_at
  FROM orders o
  WHERE o.wallet_address = wallet_addr
  ORDER BY o.created_at DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update or replace the wallet debug function to be much simpler
CREATE OR REPLACE FUNCTION debug_wallet_headers_raw(test_wallet text) 
RETURNS jsonb AS $$
DECLARE
  header_info jsonb;
  direct_orders jsonb;
BEGIN
  -- Log and get headers info
  header_info := log_request_headers();
  
  -- Get direct orders sample (bypassing RLS for diagnostic only)
  SELECT jsonb_agg(row_to_json(o))
  FROM (
    SELECT order_number, status 
    FROM orders 
    WHERE wallet_address = test_wallet
    ORDER BY created_at DESC
    LIMIT 5
  ) o
  INTO direct_orders;
  
  -- Return complete debug info
  RETURN jsonb_build_object(
    'test_wallet', test_wallet,
    'header_info', header_info,
    'direct_orders_sample', direct_orders,
    'direct_orders_count', (SELECT COUNT(*) FROM orders WHERE wallet_address = test_wallet)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT, INSERT ON request_headers_log TO authenticated, anon;
GRANT EXECUTE ON FUNCTION log_request_headers() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_wallet_orders_direct(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION debug_wallet_headers_raw(text) TO authenticated, anon;

-- Secure user_orders view again (simpler version)
DROP VIEW IF EXISTS user_orders CASCADE;

CREATE VIEW user_orders AS
SELECT o.*
FROM orders o 
WHERE o.wallet_address = current_setting('request.headers.x-wallet-address', true);

GRANT SELECT ON user_orders TO authenticated, anon;

COMMIT; 