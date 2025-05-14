-- Add debug functions to help diagnose RLS issues
BEGIN;

-- Create a safe wrapper function for RLS debugging
CREATE OR REPLACE FUNCTION debug_orders_rls(orderId UUID DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  order_data json;
BEGIN
  -- Try to fetch the order details
  BEGIN
    IF orderId IS NOT NULL THEN
      SELECT row_to_json(o) INTO order_data 
      FROM orders o 
      WHERE o.id = orderId;
    ELSE
      SELECT json_agg(row_to_json(o)) INTO order_data 
      FROM (SELECT id, created_at, status, order_number FROM orders LIMIT 5) o;
    END IF;
  EXCEPTION WHEN others THEN
    order_data := json_build_object('error', SQLERRM);
  END;
  
  -- Build the result
  result := json_build_object(
    'timestamp', now(),
    'authenticated', auth.uid() IS NOT NULL,
    'order_data', order_data,
    'orders_count', (SELECT COUNT(*) FROM orders)
  );
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'error', SQLERRM,
      'timestamp', now()
    );
END;
$$;

-- Create a simple function to test orders access by wallet address
CREATE OR REPLACE FUNCTION find_orders_by_wallet(wallet_addr text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  order_count int;
  order_ids json;
BEGIN
  -- Get order count
  SELECT COUNT(*) INTO order_count
  FROM orders
  WHERE wallet_address = wallet_addr;
  
  -- Get first 5 order IDs
  SELECT json_agg(id) INTO order_ids
  FROM (
    SELECT id FROM orders 
    WHERE wallet_address = wallet_addr
    ORDER BY created_at DESC LIMIT 5
  ) subq;
  
  -- Return the result
  RETURN json_build_object(
    'timestamp', now(),
    'wallet_address', wallet_addr,
    'order_count', order_count,
    'latest_orders', order_ids
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'error', SQLERRM
    );
END;
$$;

COMMIT; 