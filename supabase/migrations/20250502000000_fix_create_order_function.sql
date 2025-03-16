-- Fix the create_order function to use the correct column name "variant_selections" instead of "variants"
CREATE OR REPLACE FUNCTION create_order(
  p_product_id UUID,
  p_variants JSONB,
  p_shipping_info JSONB,
  p_transaction_id TEXT,
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
  
  -- Create the order
  INSERT INTO orders (
    product_id,
    collection_id,
    variant_selections,  -- Fixed: was likely "variants" before, causing the error
    shipping_address,
    contact_info,
    transaction_signature,
    wallet_address,
    status
  ) VALUES (
    p_product_id,
    v_collection_id,
    p_variants,
    p_shipping_info->>'shipping_address',
    p_shipping_info->>'contact_info',
    p_transaction_id,
    p_wallet_address,
    'pending'
  )
  RETURNING id INTO v_order_id;
  
  -- Log the successful order creation if the function exists
  BEGIN
    PERFORM log_order_creation_success(p_transaction_id, v_order_id);
  EXCEPTION WHEN OTHERS THEN
    -- Function might not exist yet if migrations are applied out of order
    RAISE NOTICE 'Could not log order creation success: %', SQLERRM;
  END;
  
  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql; 