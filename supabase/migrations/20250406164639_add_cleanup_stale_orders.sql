-- Start transaction
BEGIN;

-- Create function to clean up stale draft orders
CREATE OR REPLACE FUNCTION cleanup_stale_orders(
  p_hours_threshold int DEFAULT 24
)
RETURNS int AS $$
DECLARE
  v_cleaned_count int;
BEGIN
  -- Delete stale draft orders that are older than the threshold
  -- and have no transaction signature (abandoned carts)
  WITH deleted AS (
    DELETE FROM orders
    WHERE 
      status = 'draft'
      AND created_at < (NOW() - (p_hours_threshold || ' hours')::interval)
      AND (transaction_signature IS NULL OR transaction_signature = '')
    RETURNING id
  )
  SELECT COUNT(*) INTO v_cleaned_count FROM deleted;
  
  -- Return the number of cleaned orders
  RETURN v_cleaned_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get abandoned orders without deleting them
CREATE OR REPLACE FUNCTION get_abandoned_orders(
  p_hours_threshold int DEFAULT 24,
  p_limit int DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  product_name text,
  wallet_address text,
  created_at timestamptz,
  hours_abandoned numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    p.name as product_name,
    o.wallet_address,
    o.created_at,
    EXTRACT(EPOCH FROM (NOW() - o.created_at))/3600 as hours_abandoned
  FROM orders o
  JOIN products p ON p.id = o.product_id
  WHERE 
    o.status = 'draft'
    AND o.created_at < (NOW() - (p_hours_threshold || ' hours')::interval)
    AND (o.transaction_signature IS NULL OR o.transaction_signature = '')
  ORDER BY o.created_at ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to monitor stale pending_payment orders 
CREATE OR REPLACE FUNCTION get_stale_pending_payments(
  p_hours_threshold int DEFAULT 24,
  p_limit int DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  product_name text,
  wallet_address text,
  transaction_signature text,
  payment_method text,
  amount_sol numeric,
  created_at timestamptz,
  updated_at timestamptz,
  hours_pending numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    p.name as product_name,
    o.wallet_address,
    o.transaction_signature,
    COALESCE(o.payment_metadata->>'paymentMethod', 
             CASE WHEN o.transaction_signature LIKE 'pi_%' THEN 'stripe'
                  WHEN o.transaction_signature LIKE 'free_%' THEN 'free'
                  ELSE 'solana' END) as payment_method,
    o.amount_sol,
    o.created_at,
    o.updated_at,
    EXTRACT(EPOCH FROM (NOW() - o.updated_at))/3600 as hours_pending
  FROM orders o
  JOIN products p ON p.id = o.product_id
  WHERE 
    o.status = 'pending_payment'
    AND o.updated_at < (NOW() - (p_hours_threshold || ' hours')::interval)
  ORDER BY o.updated_at ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to recover stuck Stripe payments
CREATE OR REPLACE FUNCTION recover_stale_stripe_payment(
  p_order_id uuid,
  p_action text DEFAULT 'check' -- 'check', 'confirm', or 'cancel'
)
RETURNS jsonb AS $$
DECLARE
  v_order record;
  v_result jsonb;
BEGIN
  -- Get the order details
  SELECT 
    o.id,
    o.status,
    o.transaction_signature,
    o.payment_metadata,
    o.created_at,
    o.updated_at
  INTO v_order
  FROM orders o
  WHERE o.id = p_order_id
  AND o.status = 'pending_payment'
  AND o.transaction_signature LIKE 'pi_%';
  
  -- Check if the order exists and is a Stripe payment in pending_payment status
  IF v_order IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found or is not a pending Stripe payment'
    );
  END IF;
  
  -- Return order details if just checking
  IF p_action = 'check' THEN
    RETURN jsonb_build_object(
      'success', true,
      'order', jsonb_build_object(
        'id', v_order.id,
        'status', v_order.status,
        'transaction_signature', v_order.transaction_signature,
        'payment_metadata', v_order.payment_metadata,
        'created_at', v_order.created_at,
        'updated_at', v_order.updated_at,
        'hours_pending', EXTRACT(EPOCH FROM (NOW() - v_order.updated_at))/3600
      ),
      'action', 'check'
    );
  END IF;
  
  -- Confirm the payment
  IF p_action = 'confirm' THEN
    UPDATE orders
    SET 
      status = 'confirmed',
      payment_confirmed_at = NOW(),
      updated_at = NOW(),
      payment_metadata = jsonb_set(
        coalesce(payment_metadata, '{}'::jsonb),
        '{recovery_info}',
        jsonb_build_object(
          'action', 'manual_confirm',
          'timestamp', NOW()
        )
      )
    WHERE id = p_order_id
    AND status = 'pending_payment';
    
    RETURN jsonb_build_object(
      'success', true,
      'order_id', p_order_id,
      'action', 'confirm',
      'message', 'Payment manually confirmed'
    );
  END IF;
  
  -- Cancel the payment
  IF p_action = 'cancel' THEN
    UPDATE orders
    SET 
      status = 'cancelled',
      updated_at = NOW(),
      payment_metadata = jsonb_set(
        coalesce(payment_metadata, '{}'::jsonb),
        '{recovery_info}',
        jsonb_build_object(
          'action', 'manual_cancel',
          'timestamp', NOW()
        )
      )
    WHERE id = p_order_id
    AND status = 'pending_payment';
    
    RETURN jsonb_build_object(
      'success', true,
      'order_id', p_order_id,
      'action', 'cancel',
      'message', 'Payment manually cancelled'
    );
  END IF;
  
  -- If action is not recognized
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Invalid action. Use "check", "confirm", or "cancel"'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to service role
GRANT EXECUTE ON FUNCTION cleanup_stale_orders(int) TO service_role;
GRANT EXECUTE ON FUNCTION get_abandoned_orders(int, int) TO service_role;
GRANT EXECUTE ON FUNCTION get_stale_pending_payments(int, int) TO service_role;
GRANT EXECUTE ON FUNCTION recover_stale_stripe_payment(uuid, text) TO service_role;

COMMIT; 