-- Start transaction
BEGIN;

-- Drop existing insert policies
DROP POLICY IF EXISTS "orders_insert" ON orders;
DROP POLICY IF EXISTS "orders_insert_authenticated" ON orders;

-- Create new insert policy that allows public access
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

-- Update the create_order function to be accessible by public
DROP FUNCTION IF EXISTS create_order(uuid, jsonb, jsonb, text, text);
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
  
  -- Verify the product is in a visible collection
  IF NOT EXISTS (
    SELECT 1 FROM collections
    WHERE id = v_collection_id
    AND visible = true
  ) THEN
    RAISE EXCEPTION 'Product is not available for purchase';
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
    p_shipping_info->'shipping_address',
    p_shipping_info->'contact_info',
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions to public role
GRANT USAGE ON SCHEMA public TO public;
GRANT INSERT ON orders TO public;
GRANT EXECUTE ON FUNCTION create_order(UUID, JSONB, JSONB, TEXT, TEXT) TO public;

COMMIT; 