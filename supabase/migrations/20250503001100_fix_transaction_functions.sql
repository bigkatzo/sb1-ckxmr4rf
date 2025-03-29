-- Start transaction
BEGIN;

-- Create function to update transaction status
CREATE OR REPLACE FUNCTION update_transaction_status(
  p_signature TEXT,
  p_status TEXT,
  p_details JSONB DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  -- Verify status is valid
  IF p_status NOT IN ('pending', 'confirmed', 'failed') THEN
    RAISE EXCEPTION 'Invalid transaction status: %', p_status;
  END IF;

  -- Update transaction log
  UPDATE transaction_logs
  SET 
    status = p_status,
    details = p_details,
    updated_at = now()
  WHERE signature = p_signature;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old confirm_order_payment function to avoid overloading issues
DROP FUNCTION IF EXISTS confirm_order_payment(TEXT, TEXT);
DROP FUNCTION IF EXISTS confirm_order_payment(TEXT, TEXT, JSONB);

-- Create new confirm_order_payment function with a different name to avoid conflicts
CREATE OR REPLACE FUNCTION confirm_order_payment_with_details(
  p_transaction_signature TEXT,
  p_status TEXT,
  p_verified_details JSONB DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  -- Verify status is valid
  IF p_status NOT IN ('confirmed', 'failed') THEN
    RAISE EXCEPTION 'Invalid transaction status: %', p_status;
  END IF;

  -- Update order status
  UPDATE orders
  SET 
    status = CASE 
      WHEN p_status = 'confirmed' THEN 'confirmed'
      WHEN p_status = 'failed' THEN 'cancelled'
      ELSE status
    END,
    updated_at = now()
  WHERE transaction_signature = p_transaction_signature
  AND status = 'pending_payment';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION update_transaction_status(TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION confirm_order_payment_with_details(TEXT, TEXT, JSONB) TO authenticated;

COMMIT; 