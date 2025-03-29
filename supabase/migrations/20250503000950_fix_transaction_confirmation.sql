-- Start transaction
BEGIN;

-- Update the confirm_order_payment function to use transaction_signature
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

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION confirm_order_payment(TEXT, TEXT) TO authenticated;

COMMIT; 