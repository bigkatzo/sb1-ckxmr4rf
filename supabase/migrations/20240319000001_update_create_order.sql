-- Drop existing function if it exists
DROP FUNCTION IF EXISTS create_order;

-- Recreate function with payment metadata parameter
CREATE OR REPLACE FUNCTION create_order(
  p_product_id UUID,
  p_variants JSONB,
  p_shipping_info JSONB,
  p_wallet_address TEXT,
  p_payment_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id UUID;
  v_order_number TEXT;
BEGIN
  -- Generate order number (you can customize this format)
  SELECT TO_CHAR(NOW(), 'YYMMDDHH24MISS') || LPAD(FLOOR(RANDOM() * 1000)::TEXT, 3, '0')
  INTO v_order_number;

  -- Create the order
  INSERT INTO orders (
    product_id,
    variants,
    shipping_info,
    wallet_address,
    order_number,
    payment_metadata
  )
  VALUES (
    p_product_id,
    p_variants,
    p_shipping_info,
    p_wallet_address,
    v_order_number,
    p_payment_metadata
  )
  RETURNING id INTO v_order_id;

  RETURN v_order_id;
END;
$$; 