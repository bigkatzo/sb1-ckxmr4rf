-- Start transaction
BEGIN;

-- Create function to update order transaction details (draft -> pending_payment)
CREATE OR REPLACE FUNCTION update_order_transaction(
  p_order_id uuid,
  p_transaction_signature text,
  p_amount_sol numeric
)
RETURNS void AS $$
BEGIN
  -- Update order with transaction details and set status to pending_payment
  UPDATE orders
  SET 
    transaction_signature = CASE 
      WHEN p_transaction_signature = 'rejected' THEN NULL -- Don't store 'rejected' as signature
      ELSE p_transaction_signature
    END,
    amount_sol = p_amount_sol,
    status = 'pending_payment',
    updated_at = now()
  WHERE id = p_order_id
  AND status = 'draft';

  -- If no rows were updated, the order wasn't in draft status
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found or not in draft status';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to confirm transaction (pending_payment -> confirmed)
CREATE OR REPLACE FUNCTION confirm_order_transaction(
  p_order_id uuid
)
RETURNS void AS $$
BEGIN
  -- Update order status to confirmed
  UPDATE orders
  SET 
    status = 'confirmed',
    updated_at = now()
  WHERE id = p_order_id
  AND status = 'pending_payment';

  -- If no rows were updated, the order wasn't in pending_payment status
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found or not in pending_payment status';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION update_order_transaction(uuid, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION confirm_order_transaction(uuid) TO authenticated;

COMMIT; 