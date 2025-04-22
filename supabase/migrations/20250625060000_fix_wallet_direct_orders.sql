-- Fix the wallet direct orders function to handle type conversions correctly
BEGIN;

-- Update the function to properly cast the enum types
CREATE OR REPLACE FUNCTION get_wallet_orders_direct(wallet_addr text)
RETURNS TABLE (
  id uuid,
  order_number text,
  status text, -- Using text for status instead of enum
  wallet_address text,
  created_at timestamptz
) AS $$
BEGIN
  -- Log the headers first
  PERFORM log_request_headers();
  
  -- Return orders directly for the wallet address and cast the status to text
  RETURN QUERY
  SELECT 
    o.id,
    o.order_number,
    o.status::text, -- Cast enum to text
    o.wallet_address,
    o.created_at
  FROM orders o
  WHERE o.wallet_address = wallet_addr
  ORDER BY o.created_at DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a simplified function that only returns the count of wallet orders
CREATE OR REPLACE FUNCTION count_wallet_orders(wallet_addr text)
RETURNS integer AS $$
DECLARE
  order_count integer;
BEGIN
  -- Just count the orders for this wallet
  SELECT COUNT(*) INTO order_count
  FROM orders
  WHERE wallet_address = wallet_addr;
  
  RETURN order_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a simplified one-stop debug function 
CREATE OR REPLACE FUNCTION wallet_auth_debug(wallet_addr text DEFAULT NULL)
RETURNS jsonb AS $$
DECLARE
  header_wallet text;
  header_token text;
  direct_count integer;
  view_count integer;
  order_sample jsonb;
BEGIN
  -- Log headers
  PERFORM log_request_headers();
  
  -- Get wallet from headers
  BEGIN
    header_wallet := current_setting('request.headers.x-wallet-address', true);
    header_token := current_setting('request.headers.x-wallet-auth-token', true);
  EXCEPTION WHEN OTHERS THEN
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
  direct_count := count_wallet_orders(wallet_addr);
  
  -- Count through view
  BEGIN
    EXECUTE 'SELECT COUNT(*) FROM user_orders WHERE wallet_address = $1' 
    INTO view_count
    USING wallet_addr;
  EXCEPTION WHEN OTHERS THEN
    view_count := 0;
  END;
  
  -- Get sample orders
  SELECT jsonb_agg(jsonb_build_object(
    'order_number', o.order_number,
    'status', o.status::text
  ))
  FROM (
    SELECT order_number, status
    FROM orders
    WHERE wallet_address = wallet_addr
    ORDER BY created_at DESC
    LIMIT 5
  ) o
  INTO order_sample;
  
  -- Return final debug info
  RETURN jsonb_build_object(
    'success', true,
    'wallet_address', wallet_addr,
    'headers_present', header_wallet IS NOT NULL AND header_token IS NOT NULL,
    'wallet_matches_header', wallet_addr = header_wallet,
    'direct_orders_count', direct_count,
    'view_orders_count', view_count,
    'order_sample', COALESCE(order_sample, '[]'::jsonb)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_wallet_orders_direct(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION count_wallet_orders(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION wallet_auth_debug(text) TO authenticated, anon;

COMMIT; 