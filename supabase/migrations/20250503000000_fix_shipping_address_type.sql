-- Fix the create_order function to properly handle JSONB types for shipping_address and contact_info
-- The previous version was extracting these as text with the ->> operator, but they should remain as JSONB

-- Drop the existing function
DROP FUNCTION IF EXISTS create_order(UUID, JSONB, JSONB, TEXT, TEXT);

-- Recreate the function with the correct type handling
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
    variant_selections,
    shipping_address,
    contact_info,
    transaction_signature,
    wallet_address,
    status
  ) VALUES (
    p_product_id,
    v_collection_id,
    p_variants,
    p_shipping_info->'shipping_address',  -- Fixed: use -> instead of ->> to keep as JSONB
    p_shipping_info->'contact_info',      -- Fixed: use -> instead of ->> to keep as JSONB
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

-- Add a comment to the function
COMMENT ON FUNCTION create_order(UUID, JSONB, JSONB, TEXT, TEXT) IS 
  'Creates an order with the given product, variants, shipping info, and transaction details. 
   Returns the ID of the created order. Fixed to properly handle JSONB types.'; 