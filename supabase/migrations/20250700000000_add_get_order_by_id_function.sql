-- Add a secure RPC function to get order details by ID
-- This function is specifically designed to allow fetching order details 
-- in the checkout success flow without requiring wallet auth
BEGIN;

CREATE OR REPLACE FUNCTION get_order_by_id(order_id uuid)
RETURNS jsonb AS $$
DECLARE
  order_record orders;
  result jsonb;
BEGIN
  -- Fetch the order record
  SELECT * INTO order_record FROM orders WHERE id = order_id;
  
  -- Check if order was found
  IF order_record IS NULL THEN
    RETURN jsonb_build_object('error', 'Order not found');
  END IF;
  
  -- Return minimal order details (just what's needed for success view)
  result := jsonb_build_object(
    'order_number', order_record.order_number,
    'status', order_record.status,
    'created_at', order_record.created_at
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION get_order_by_id(uuid) TO authenticated, anon;

-- Add a comment explaining the function's purpose
COMMENT ON FUNCTION get_order_by_id IS 'Securely retrieves order details by order ID for checkout success flow';

COMMIT; 