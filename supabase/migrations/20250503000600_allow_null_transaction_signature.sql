-- Start transaction
BEGIN;

-- Make transaction_signature nullable
ALTER TABLE orders
ALTER COLUMN transaction_signature DROP NOT NULL;

-- Update the create_order function to match the current schema
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

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION create_order(UUID, JSONB, JSONB, TEXT) TO public;

COMMIT; 