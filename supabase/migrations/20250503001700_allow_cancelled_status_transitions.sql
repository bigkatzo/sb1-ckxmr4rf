-- Start transaction
BEGIN;

-- Update the status transition validation function to allow transitions from cancelled
CREATE OR REPLACE FUNCTION public.validate_order_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow any transition from NULL (new order)
  IF OLD.status IS NULL THEN
    RETURN NEW;
  END IF;

  -- Define valid transitions
  -- Payment-related transitions (strict)
  IF (OLD.status = 'draft' AND NEW.status = 'pending_payment') OR
     (OLD.status = 'pending_payment' AND NEW.status = 'confirmed') OR
     (OLD.status = 'pending_payment' AND NEW.status = 'cancelled') OR
     (OLD.status = 'draft' AND NEW.status = 'cancelled') OR
     -- Post-payment transitions (flexible)
     (OLD.status = 'confirmed' AND NEW.status IN ('shipped', 'delivered', 'cancelled')) OR
     (OLD.status = 'shipped' AND NEW.status IN ('confirmed', 'delivered', 'cancelled')) OR
     (OLD.status = 'delivered' AND NEW.status IN ('cancelled', 'shipped', 'confirmed')) OR
     -- Allow transitions from cancelled to other statuses
     (OLD.status = 'cancelled' AND NEW.status IN ('confirmed', 'shipped', 'delivered')) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid order status transition from % to %', OLD.status, NEW.status;
END;
$$ LANGUAGE plpgsql;

COMMIT; 