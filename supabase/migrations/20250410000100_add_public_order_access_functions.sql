-- Start transaction
BEGIN;

-- Create a function to get order details by ID (no RLS)
CREATE OR REPLACE FUNCTION public.get_order_by_id(order_id uuid)
RETURNS SETOF orders
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM orders WHERE id = order_id;
END;
$$;

-- Create a function to get order details with product info by ID (no RLS)
CREATE OR REPLACE FUNCTION public.get_order_details_by_id(order_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  order_details json;
BEGIN
  SELECT 
    json_build_object(
      'order', o,
      'product', p,
      'collection', c
    ) INTO order_details
  FROM 
    orders o
    LEFT JOIN products p ON p.id = o.product_id
    LEFT JOIN collections c ON c.id = o.collection_id
  WHERE 
    o.id = order_id;

  RETURN order_details;
END;
$$;

-- Create a function to get orders by wallet address (no RLS)
CREATE OR REPLACE FUNCTION public.get_orders_by_wallet(wallet_addr text)
RETURNS SETOF orders
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM orders 
  WHERE wallet_address = wallet_addr
  ORDER BY created_at DESC;
END;
$$;

-- Create a function that can confirm an order by ID
CREATE OR REPLACE FUNCTION public.confirm_order_by_id(order_id uuid)
RETURNS SETOF orders
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_order orders;
BEGIN
  UPDATE orders
  SET 
    status = 'confirmed',
    updated_at = now()
  WHERE 
    id = order_id
    AND status = 'pending_payment'
  RETURNING * INTO updated_order;

  RETURN QUERY SELECT * FROM updated_order;
END;
$$;

-- Grant execute permissions to all functions
GRANT EXECUTE ON FUNCTION public.get_order_by_id(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_order_details_by_id(uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_orders_by_wallet(text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_order_by_id(uuid) TO authenticated, anon, service_role;

COMMIT; 