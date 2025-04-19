-- Start transaction
BEGIN;

-- Create a direct update function that doesn't rely on transaction_signature lookup
-- Simplified to exactly match what the frontend does
CREATE OR REPLACE FUNCTION direct_update_order_status(
  p_order_id UUID,
  p_status TEXT
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

  -- Update the order with the specified status - exactly matching frontend implementation
  -- The frontend just does .update({ status }) without any conditions
  UPDATE orders
  SET 
    status = p_status
  WHERE id = p_order_id
  AND status = 'pending_payment' -- Add status check for better data integrity
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
GRANT EXECUTE ON FUNCTION direct_update_order_status(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION direct_update_order_status(UUID, TEXT) TO service_role;

COMMIT; 