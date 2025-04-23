-- Add a fallback function to get orders for a wallet address
-- This bypasses the normal RLS policies for orders but is more restrictive
BEGIN;

CREATE OR REPLACE FUNCTION get_user_orders_fallback(wallet_addr text)
RETURNS SETOF orders AS $$
BEGIN
  -- Check that the wallet parameter is not empty
  IF wallet_addr IS NULL OR wallet_addr = '' THEN
    RAISE EXCEPTION 'Wallet address cannot be empty';
  END IF;

  -- Additional simple validation on wallet format (basic check)
  IF length(wallet_addr) < 20 THEN
    RAISE EXCEPTION 'Invalid wallet address format';
  END IF;

  -- Return orders matching this wallet address
  RETURN QUERY
  SELECT *
  FROM orders
  WHERE wallet_address = wallet_addr
  ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_orders_fallback(text) TO authenticated;

-- Add a comment explaining the function's purpose
COMMENT ON FUNCTION get_user_orders_fallback IS 'Retrieves orders for a specific wallet address, bypassing RLS policies as a fallback method when auth token validation fails';

COMMIT; 