-- Migration to make status transitions more flexible and update order status functions
BEGIN;

-- Update the order status constraint to include the new 'preparing' status
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('draft', 'pending_payment', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled'));

-- Create or replace the merchant_update_order_status function to handle the new status
CREATE OR REPLACE FUNCTION merchant_update_order_status(
  p_order_id uuid,
  p_status text
)
RETURNS jsonb AS $$
DECLARE
  v_order_id uuid;
  v_old_status text;
BEGIN
  -- Verify proper access to this order
  IF NOT EXISTS (
    SELECT 1 FROM orders o
    JOIN products p ON p.id = o.product_id
    JOIN collections c ON c.id = p.collection_id
    LEFT JOIN collection_access ca ON ca.collection_id = c.id AND ca.user_id = auth.uid()
    LEFT JOIN user_profiles up ON up.id = auth.uid()
    WHERE o.id = p_order_id
    AND (
      -- Admin access
      up.role = 'admin'
      OR 
      -- Collection owner
      c.user_id = auth.uid()
      OR 
      -- Edit access through collection_access
      ca.access_type = 'edit'
    )
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Access denied: Edit permission required to update order status'
    );
  END IF;

  -- Get current order status
  SELECT id, status::text INTO v_order_id, v_old_status
  FROM orders
  WHERE id = p_order_id;
  
  IF v_order_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Order not found'
    );
  END IF;
  
  -- Verify status is valid - now includes the new 'preparing' status
  IF p_status NOT IN ('confirmed', 'preparing', 'shipped', 'delivered', 'cancelled') THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', format('Invalid order status: %s', p_status)
    );
  END IF;

  -- Update order status
  UPDATE orders
  SET 
    status = p_status::order_status_enum,
    updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Order status updated from %s to %s', v_old_status, p_status),
    'order_id', p_order_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the update_order_status function as a wrapper around merchant_update_order_status
CREATE OR REPLACE FUNCTION update_order_status(
  p_order_id uuid,
  p_status text
)
RETURNS jsonb AS $$
BEGIN
  -- This is just a wrapper around merchant_update_order_status
  -- for backward compatibility
  RETURN merchant_update_order_status(p_order_id, p_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant merchant functions to authenticated users
GRANT EXECUTE ON FUNCTION merchant_update_order_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION update_order_status(uuid, text) TO authenticated;

-- Create or replace the validate_order_status_transition function to allow more flexible transitions
CREATE OR REPLACE FUNCTION public.validate_order_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow any transition from NULL (new order)
  IF OLD.status IS NULL THEN
    RETURN NEW;
  END IF;

  -- Allow same status (no change)
  IF (OLD.status = NEW.status) THEN
    RETURN NEW;
  END IF;

  -- Define valid transitions
  -- Payment-related transitions (strict, only allowed by system functions)
  IF (OLD.status = 'draft' AND NEW.status = 'pending_payment') OR
     (OLD.status = 'pending_payment' AND NEW.status = 'confirmed') OR
     (OLD.status = 'pending_payment' AND NEW.status = 'cancelled') OR
     (OLD.status = 'draft' AND NEW.status = 'cancelled') THEN
    RETURN NEW;
  END IF;

  -- Post-payment transitions - Now more flexible to allow merchants to move orders freely
  -- Allow changing from cancelled to any post-payment status
  IF OLD.status = 'cancelled' AND 
     NEW.status IN ('confirmed', 'preparing', 'shipped', 'delivered') THEN
    RETURN NEW;
  END IF;

  -- Allow transitions between post-payment statuses
  IF OLD.status IN ('confirmed', 'preparing', 'shipped', 'delivered') AND 
     NEW.status IN ('confirmed', 'preparing', 'shipped', 'delivered', 'cancelled') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid order status transition from % to %', OLD.status, NEW.status;
END;
$$ LANGUAGE plpgsql;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS validate_order_status_trigger ON orders;
CREATE TRIGGER validate_order_status_trigger
  BEFORE UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_order_status_transition();

COMMIT; 