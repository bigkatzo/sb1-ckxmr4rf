-- Start transaction
BEGIN;

-- Add new order statuses and transaction statuses
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_transaction_status_check;

ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('draft', 'pending_payment', 'confirmed', 'shipped', 'delivered', 'cancelled'));

ALTER TABLE orders ADD CONSTRAINT orders_transaction_status_check
  CHECK (transaction_status IN ('pending', 'confirmed', 'failed'));

-- Update the create_order function to handle the new flow
CREATE OR REPLACE FUNCTION create_order(
  p_product_id UUID,
  p_variants JSONB,
  p_shipping_info JSONB,
  p_wallet_address TEXT
)
RETURNS UUID AS $$
DECLARE
  v_collection_id UUID;
  v_order_id UUID;
BEGIN
  -- Get the collection ID from the product
  SELECT collection_id INTO v_collection_id
  FROM products
  WHERE id = p_product_id;
  
  IF v_collection_id IS NULL THEN
    RAISE EXCEPTION 'Product not found or has no collection: %', p_product_id;
  END IF;
  
  -- Verify the product is in a visible collection
  IF NOT EXISTS (
    SELECT 1 FROM collections
    WHERE id = v_collection_id
    AND visible = true
  ) THEN
    RAISE EXCEPTION 'Product is not available for purchase';
  END IF;
  
  -- Create the order in draft status
  INSERT INTO orders (
    product_id,
    collection_id,
    variant_selections,
    shipping_address,
    contact_info,
    wallet_address,
    status,
    transaction_status
  ) VALUES (
    p_product_id,
    v_collection_id,
    p_variants,
    p_shipping_info->'shipping_address',
    p_shipping_info->'contact_info',
    p_wallet_address,
    'draft',
    'pending'
  )
  RETURNING id INTO v_order_id;
  
  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to initiate payment for an order
CREATE OR REPLACE FUNCTION initiate_order_payment(
  p_order_id UUID,
  p_transaction_id TEXT
)
RETURNS void AS $$
BEGIN
  -- Verify order exists and is in draft status
  IF NOT EXISTS (
    SELECT 1 FROM orders
    WHERE id = p_order_id
    AND status = 'draft'
  ) THEN
    RAISE EXCEPTION 'Order not found or not in draft status';
  END IF;

  -- Update order with transaction ID and change status to pending_payment
  UPDATE orders
  SET
    transaction_signature = p_transaction_id,
    status = 'pending_payment',
    updated_at = now()
  WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the transaction confirmation function
CREATE OR REPLACE FUNCTION confirm_order_payment(
  p_transaction_id TEXT,
  p_status TEXT
)
RETURNS void AS $$
BEGIN
  -- Verify status is valid
  IF p_status NOT IN ('confirmed', 'failed') THEN
    RAISE EXCEPTION 'Invalid transaction status: %', p_status;
  END IF;

  -- Update order status based on transaction status
  UPDATE orders
  SET 
    transaction_status = p_status,
    status = CASE 
      WHEN p_status = 'confirmed' THEN 'confirmed'
      WHEN p_status = 'failed' THEN 'cancelled'
      ELSE status
    END,
    updated_at = now()
  WHERE transaction_signature = p_transaction_id
  AND status = 'pending_payment';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions to public role
GRANT USAGE ON SCHEMA public TO public;
GRANT INSERT ON orders TO public;
GRANT EXECUTE ON FUNCTION create_order(UUID, JSONB, JSONB, TEXT) TO public;
GRANT EXECUTE ON FUNCTION initiate_order_payment(UUID, TEXT) TO public;
GRANT EXECUTE ON FUNCTION confirm_order_payment(TEXT, TEXT) TO public;

-- Create or update RLS policies
DROP POLICY IF EXISTS "orders_insert_public" ON orders;
CREATE POLICY "orders_insert_public"
ON orders
FOR INSERT
TO public
WITH CHECK (
  -- Only verify the product exists and is in a visible collection
  EXISTS (
    SELECT 1 FROM products p
    JOIN collections c ON c.id = p.collection_id
    WHERE p.id = product_id
    AND c.visible = true
  )
);

COMMIT; 