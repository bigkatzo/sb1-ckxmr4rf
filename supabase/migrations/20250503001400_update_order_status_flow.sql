-- Start transaction
BEGIN;

-- Drop existing type if exists
DROP TYPE IF EXISTS order_status_enum CASCADE;

-- Create order status enum type
CREATE TYPE order_status_enum AS ENUM (
  'draft',
  'pending_payment',
  'confirmed',
  'cancelled'
);

-- Alter orders table to use the new enum type
ALTER TABLE orders 
  ALTER COLUMN status TYPE order_status_enum 
  USING status::order_status_enum;

-- Add constraint to ensure valid status transitions
CREATE OR REPLACE FUNCTION validate_order_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow any transition from NULL (new order)
  IF OLD.status IS NULL THEN
    RETURN NEW;
  END IF;

  -- Define valid transitions
  IF (OLD.status = 'draft' AND NEW.status = 'pending_payment') OR
     (OLD.status = 'pending_payment' AND NEW.status = 'confirmed') OR
     (OLD.status = 'pending_payment' AND NEW.status = 'cancelled') OR
     (OLD.status = 'draft' AND NEW.status = 'cancelled') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid order status transition from % to %', OLD.status, NEW.status;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for status transitions
DROP TRIGGER IF EXISTS validate_order_status_trigger ON orders;
CREATE TRIGGER validate_order_status_trigger
  BEFORE UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION validate_order_status_transition();

-- Create function to update order with transaction (draft -> pending_payment)
CREATE OR REPLACE FUNCTION update_order_transaction(
  p_order_id uuid,
  p_transaction_signature text,
  p_amount_sol numeric
)
RETURNS void AS $$
BEGIN
  UPDATE orders
  SET 
    transaction_signature = p_transaction_signature,
    amount_sol = p_amount_sol,
    status = 'pending_payment',
    updated_at = now()
  WHERE id = p_order_id
  AND status = 'draft';

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
  UPDATE orders
  SET 
    status = 'confirmed',
    updated_at = now()
  WHERE id = p_order_id
  AND status = 'pending_payment';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found or not in pending_payment status';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION update_order_transaction(uuid, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION confirm_order_transaction(uuid) TO authenticated;

COMMIT; 