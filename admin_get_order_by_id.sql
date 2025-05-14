-- Function to get an order by ID, bypassing RLS policies
-- This should be run in the Supabase SQL editor
-- It allows the server to retrieve order details even when RLS might cause recursion issues

CREATE OR REPLACE FUNCTION admin_get_order_by_id(p_order_id UUID)
RETURNS SETOF orders
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY 
  SELECT * FROM orders 
  WHERE id = p_order_id;
END;
$$;

-- Add comment to function
COMMENT ON FUNCTION admin_get_order_by_id(UUID) IS 'Admin function to get order details by ID, bypassing RLS policies'; 