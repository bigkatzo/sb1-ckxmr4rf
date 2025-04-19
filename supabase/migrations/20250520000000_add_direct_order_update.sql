-- Start transaction
BEGIN;

-- Create a direct update function that doesn't rely on transaction_signature lookup
CREATE OR REPLACE FUNCTION direct_update_order_status(
  p_order_id UUID,
  p_status TEXT,
  p_payment_confirmed_at TIMESTAMPTZ DEFAULT now()
)
RETURNS jsonb AS $$
DECLARE
  v_old_status text;
  v_affected_rows integer;
BEGIN
  -- Validate status is valid
  IF p_status NOT IN ('confirmed', 'failed', 'cancelled', 'shipped', 'delivered') THEN
    RAISE EXCEPTION 'Invalid order status: %', p_status;
  END IF;

  -- Get the current status
  SELECT status INTO v_old_status
  FROM orders
  WHERE id = p_order_id;

  -- Update the order with the specified status
  UPDATE orders
  SET 
    status = p_status,
    payment_confirmed_at = CASE 
      WHEN p_status = 'confirmed' AND v_old_status = 'pending_payment' THEN p_payment_confirmed_at
      ELSE payment_confirmed_at
    END,
    updated_at = now()
  WHERE id = p_order_id
  AND status IN ('pending_payment', 'confirmed', 'ready_to_ship')
  RETURNING 1 INTO v_affected_rows;

  -- Check if any rows were updated
  IF v_affected_rows IS NULL OR v_affected_rows = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Order not found or status cannot be updated',
      'order_id', p_order_id
    );
  END IF;

  -- Return success with details
  RETURN jsonb_build_object(
    'success', true,
    'message', format('Order %s successfully updated from "%s" to "%s"', p_order_id, v_old_status, p_status),
    'order_id', p_order_id,
    'old_status', v_old_status,
    'new_status', p_status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION direct_update_order_status(UUID, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION direct_update_order_status(UUID, TEXT, TIMESTAMPTZ) TO service_role;

COMMIT; 