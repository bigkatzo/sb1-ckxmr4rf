-- Fix permissions for create_order function
-- This migration ensures that both authenticated and anonymous users
-- can execute the create_order function

BEGIN;

-- First ensure the function uses SECURITY DEFINER
CREATE OR REPLACE FUNCTION create_order(
  p_product_id UUID,
  p_variants JSONB,
  p_shipping_info JSONB,
  p_wallet_address TEXT,
  p_payment_metadata JSONB DEFAULT '{}'::jsonb
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
    payment_metadata
  ) VALUES (
    p_product_id,
    v_collection_id,
    p_variants,
    p_shipping_info->'shipping_address',
    p_shipping_info->'contact_info',
    p_wallet_address,
    'draft',
    p_payment_metadata
  )
  RETURNING id INTO v_order_id;
  
  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Explicitly grant execute permissions to all users
GRANT EXECUTE ON FUNCTION create_order(UUID, JSONB, JSONB, TEXT, JSONB) TO public;
GRANT EXECUTE ON FUNCTION create_order(UUID, JSONB, JSONB, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION create_order(UUID, JSONB, JSONB, TEXT, JSONB) TO anon;

-- Also ensure update_order_transaction can be executed by all users
GRANT EXECUTE ON FUNCTION update_order_transaction(uuid, text, numeric) TO public;
GRANT EXECUTE ON FUNCTION update_order_transaction(uuid, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION update_order_transaction(uuid, text, numeric) TO anon;

-- Ensure confirm_order_transaction can be executed by all users
GRANT EXECUTE ON FUNCTION confirm_order_transaction(uuid) TO public;
GRANT EXECUTE ON FUNCTION confirm_order_transaction(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION confirm_order_transaction(uuid) TO anon;

COMMIT; 