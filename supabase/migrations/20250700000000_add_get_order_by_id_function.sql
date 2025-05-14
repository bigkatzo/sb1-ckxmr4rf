-- Add a secure RPC function to get order details by ID
-- This function is specifically designed to allow fetching order details 
-- in the checkout success flow without requiring wallet auth
BEGIN;

-- Drop existing functions first to avoid parameter name conflict
DROP FUNCTION IF EXISTS get_order_by_id(uuid);
DROP FUNCTION IF EXISTS get_orders_by_batch_id(uuid);
DROP FUNCTION IF EXISTS get_orders_by_transaction(text);

-- Create a function to get order by ID (bypassing RLS)
CREATE OR REPLACE FUNCTION get_order_by_id(p_order_id UUID)
RETURNS SETOF orders
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT * FROM orders WHERE id = p_order_id;
END;
$$;

-- Create a function to get orders by batch ID (bypassing RLS)
CREATE OR REPLACE FUNCTION get_orders_by_batch_id(p_batch_order_id UUID)
RETURNS SETOF orders
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT * FROM orders WHERE batch_order_id = p_batch_order_id ORDER BY item_index ASC;
END;
$$;

-- Create a function to get orders by transaction signature (bypassing RLS)
CREATE OR REPLACE FUNCTION get_orders_by_transaction(p_transaction_signature TEXT)
RETURNS SETOF orders
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT * FROM orders WHERE transaction_signature = p_transaction_signature;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_order_by_id(UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_orders_by_batch_id(UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_orders_by_transaction(TEXT) TO authenticated, anon, service_role;

-- Add a comment explaining the function's purpose
COMMENT ON FUNCTION get_order_by_id IS 'Securely retrieves order details by order ID for checkout success flow';

COMMIT; 