-- Start transaction
BEGIN;

-- Update create_order function to use variant_selections
CREATE OR REPLACE FUNCTION create_order(
  p_product_id uuid,
  p_variants jsonb,
  p_shipping_info jsonb,
  p_transaction_id text,
  p_wallet_address text
)
RETURNS uuid AS $$
DECLARE
  v_order_id uuid;
BEGIN
  INSERT INTO orders (
    product_id,
    variant_selections,
    shipping_info,
    transaction_id,
    wallet_address
  )
  VALUES (
    p_product_id,
    COALESCE(p_variants, '[]'::jsonb),
    p_shipping_info,
    p_transaction_id,
    COALESCE(p_wallet_address, auth.jwt()->>'wallet_address')
  )
  RETURNING id INTO v_order_id;

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT; 