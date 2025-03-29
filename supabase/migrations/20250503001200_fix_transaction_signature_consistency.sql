-- Start transaction
BEGIN;

-- Drop unnecessary columns
ALTER TABLE orders 
DROP COLUMN IF EXISTS transaction_status,
DROP COLUMN IF EXISTS verified_amount,
DROP COLUMN IF EXISTS verified_buyer_address,
DROP COLUMN IF EXISTS verified_at;

-- Drop indexes using old column name
DROP INDEX IF EXISTS idx_orders_transaction_id;

-- Create index for transaction_signature if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_orders_transaction_signature ON orders(transaction_signature);

-- Drop old functions that referenced transaction_status
DROP FUNCTION IF EXISTS confirm_order_payment(TEXT, TEXT);
DROP FUNCTION IF EXISTS confirm_order_payment(TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS confirm_order_payment_with_details(TEXT, TEXT, JSONB);

-- Create new simplified confirm_order_payment function
CREATE OR REPLACE FUNCTION confirm_order_payment(
  p_transaction_signature TEXT,
  p_status TEXT
)
RETURNS jsonb AS $$
DECLARE
  v_message text;
  v_order_id uuid;
BEGIN
  -- Verify status is valid
  IF p_status NOT IN ('confirmed', 'failed') THEN
    RAISE EXCEPTION 'Invalid transaction status: %', p_status;
  END IF;

  -- Update order status and get order id
  UPDATE orders
  SET 
    status = CASE 
      WHEN p_status = 'confirmed' THEN 'confirmed'
      WHEN p_status = 'failed' THEN 'cancelled'
      ELSE status
    END,
    updated_at = now()
  WHERE transaction_signature = p_transaction_signature
  AND status = 'pending_payment'
  RETURNING id INTO v_order_id;

  -- Set appropriate message
  IF p_status = 'failed' THEN
    v_message := 'Transaction failed. Please try again with a new transaction.';
  ELSE
    v_message := 'Order confirmed successfully.';
  END IF;

  -- Return result as JSON
  RETURN jsonb_build_object(
    'success', p_status = 'confirmed',
    'message', v_message,
    'order_id', v_order_id,
    'status', p_status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update recover_failed_order function to use transaction_signature
CREATE OR REPLACE FUNCTION recover_failed_order(
  p_signature text,
  p_shipping_info jsonb,
  p_variants jsonb DEFAULT '[]'
)
RETURNS uuid AS $$
DECLARE
  v_order_id uuid;
  v_tx_log transaction_logs;
BEGIN
  -- Get transaction log
  SELECT * INTO v_tx_log
  FROM transaction_logs
  WHERE signature = p_signature
  AND status = 'confirmed'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found or not confirmed';
  END IF;

  -- Verify order doesn't already exist
  IF EXISTS (
    SELECT 1 FROM orders WHERE transaction_signature = p_signature
  ) THEN
    RAISE EXCEPTION 'Order already exists for this transaction';
  END IF;

  -- Create the order
  INSERT INTO orders (
    product_id,
    variants,
    shipping_info,
    transaction_signature,
    status,
    wallet_address
  )
  VALUES (
    v_tx_log.product_id,
    p_variants,
    p_shipping_info,
    p_signature,
    'confirmed',
    v_tx_log.buyer_address
  )
  RETURNING id INTO v_order_id;

  -- Update transaction log
  UPDATE transaction_logs
  SET 
    status = 'order_created',
    order_id = v_order_id,
    updated_at = now()
  WHERE id = v_tx_log.id;

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION recover_failed_order(text, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION confirm_order_payment(TEXT, TEXT) TO authenticated;

COMMIT; 