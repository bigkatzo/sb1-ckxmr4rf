-- Start transaction
BEGIN;

-- First, drop all functions that will be modified with different return types
DO $$
BEGIN
    -- Drop update_order_status
    BEGIN
        EXECUTE 'DROP FUNCTION IF EXISTS update_order_status(uuid, text)';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Failed to drop update_order_status: %', SQLERRM;
    END;

    -- Drop update_order_transaction
    BEGIN
        EXECUTE 'DROP FUNCTION IF EXISTS update_order_transaction(uuid, text, numeric)';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Failed to drop update_order_transaction: %', SQLERRM;
    END;

    -- Drop confirm_order_transaction
    BEGIN
        EXECUTE 'DROP FUNCTION IF EXISTS confirm_order_transaction(uuid)';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Failed to drop confirm_order_transaction: %', SQLERRM;
    END;

    -- Drop confirm_order_payment (text, text)
    BEGIN
        EXECUTE 'DROP FUNCTION IF EXISTS confirm_order_payment(text, text)';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Failed to drop confirm_order_payment(text, text): %', SQLERRM;
    END;
END
$$;

-- Remove RLS insert policy for orders table for authenticated and anon users
DROP POLICY IF EXISTS "orders_insert_authenticated" ON orders;
DROP POLICY IF EXISTS "Authenticated users can create orders" ON orders;

-- Revoke insert privileges from public and authenticated roles
REVOKE INSERT ON orders FROM authenticated;
REVOKE INSERT ON orders FROM public;

-- Redefine create_order function to use SECURITY INVOKER instead of SECURITY DEFINER
CREATE OR REPLACE FUNCTION create_order(
  p_product_id UUID,
  p_variants JSONB,
  p_shipping_info JSONB,
  p_wallet_address TEXT,
  p_payment_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_collection_id UUID;
  v_order_id UUID;
BEGIN
  -- Get the collection ID from the product
  SELECT collection_id INTO v_collection_id
  FROM products
  WHERE id = p_product_id;
  
  IF v_collection_id IS NULL THEN
    RAISE EXCEPTION 'Product not found or has no collection: %', p_product_id;
  END IF;
  
  -- Verify the product is in a visible collection
  IF NOT EXISTS (
    SELECT 1 FROM collections
    WHERE id = v_collection_id
    AND visible = true
  ) THEN
    RAISE EXCEPTION 'Product is not available for purchase';
  END IF;
  
  -- Create the order in draft status
  INSERT INTO orders (
    product_id,
    collection_id,
    variant_selections,
    shipping_address,
    contact_info,
    wallet_address,
    status,
    payment_metadata
  ) VALUES (
    p_product_id,
    v_collection_id,
    p_variants,
    p_shipping_info->'shipping_address',
    p_shipping_info->'contact_info',
    p_wallet_address,
    'draft',
    p_payment_metadata
  )
  RETURNING id INTO v_order_id;
  
  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- Remove public execution permission on create_order
REVOKE EXECUTE ON FUNCTION create_order(UUID, JSONB, JSONB, TEXT, JSONB) FROM public;

-- Create a function to secure status updates that can only be called with service_role
CREATE OR REPLACE FUNCTION system_update_order_status(
  p_order_id UUID,
  p_new_status TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_old_status TEXT;
  v_result JSONB;
BEGIN
  -- Get the current status
  SELECT status::TEXT INTO v_old_status
  FROM orders
  WHERE id = p_order_id;
  
  IF v_old_status IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Order not found',
      'order_id', p_order_id
    );
  END IF;
  
  -- Validate the status transition
  IF (v_old_status = 'draft' AND p_new_status = 'pending_payment') OR
     (v_old_status = 'pending_payment' AND p_new_status = 'confirmed') OR
     (v_old_status = 'pending_payment' AND p_new_status = 'cancelled') OR
     (v_old_status = 'draft' AND p_new_status = 'cancelled') THEN
    
    -- Update the order status
    UPDATE orders
    SET 
      status = p_new_status::order_status_enum,
      updated_at = now()
    WHERE id = p_order_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'message', format('Order status updated from %s to %s', v_old_status, p_new_status),
      'order_id', p_order_id,
      'old_status', v_old_status,
      'new_status', p_new_status
    );
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'message', format('Invalid order status transition from %s to %s', v_old_status, p_new_status),
      'order_id', p_order_id
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only grant system update function to service_role
REVOKE EXECUTE ON FUNCTION system_update_order_status(UUID, TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION system_update_order_status(UUID, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION system_update_order_status(UUID, TEXT) TO service_role;

-- Update the update_order_transaction function to be more secure
CREATE OR REPLACE FUNCTION update_order_transaction(
  p_order_id uuid,
  p_transaction_signature text,
  p_amount_sol numeric
)
RETURNS jsonb AS $$
DECLARE
  v_old_status text;
BEGIN
  -- Get current status
  SELECT status::text INTO v_old_status
  FROM orders
  WHERE id = p_order_id;
  
  IF v_old_status IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Order not found',
      'order_id', p_order_id
    );
  END IF;
  
  IF v_old_status != 'draft' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', format('Order is not in draft status, current status is %s', v_old_status),
      'order_id', p_order_id
    );
  END IF;

  -- Update order with transaction details and set status to pending_payment
  UPDATE orders
  SET 
    transaction_signature = CASE 
      WHEN p_transaction_signature = 'rejected' THEN NULL
      ELSE p_transaction_signature
    END,
    amount_sol = p_amount_sol,
    status = 'pending_payment',
    updated_at = now()
  WHERE id = p_order_id
  AND status = 'draft';

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Order updated to pending_payment status',
    'order_id', p_order_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the confirm_order_transaction function to be more secure
CREATE OR REPLACE FUNCTION confirm_order_transaction(
  p_order_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_old_status text;
BEGIN
  -- Get current status
  SELECT status::text INTO v_old_status
  FROM orders
  WHERE id = p_order_id;
  
  IF v_old_status IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Order not found',
      'order_id', p_order_id
    );
  END IF;
  
  IF v_old_status != 'pending_payment' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', format('Order is not in pending_payment status, current status is %s', v_old_status),
      'order_id', p_order_id
    );
  END IF;

  -- Update order status to confirmed
  UPDATE orders
  SET 
    status = 'confirmed',
    updated_at = now()
  WHERE id = p_order_id
  AND status = 'pending_payment';

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Order confirmed successfully',
    'order_id', p_order_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the confirm_order_payment function directly instead of using the dynamic EXECUTE approach
CREATE OR REPLACE FUNCTION confirm_order_payment(
  p_transaction_signature TEXT,
  p_status TEXT
)
RETURNS jsonb AS $$
DECLARE
  v_order_id uuid;
  v_old_status text;
BEGIN
  -- Verify status is valid
  IF p_status NOT IN ('confirmed', 'failed') THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', format('Invalid transaction status: %s', p_status)
    );
  END IF;

  -- Get the order ID and current status
  SELECT id, status::text INTO v_order_id, v_old_status
  FROM orders
  WHERE transaction_signature = p_transaction_signature;
  
  IF v_order_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'No order found with the provided transaction signature'
    );
  END IF;
  
  IF v_old_status != 'pending_payment' THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', format('Order is not in pending_payment status, current status is %s', v_old_status),
      'order_id', v_order_id
    );
  END IF;

  -- Update order status based on transaction status
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

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Order status updated based on transaction status: %s', p_status),
    'order_id', v_order_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a new merchant/admin function specifically for post-payment status updates
CREATE OR REPLACE FUNCTION merchant_update_order_status(
  p_order_id uuid,
  p_status text
)
RETURNS jsonb AS $$
DECLARE
  v_old_status text;
  v_order_id uuid;
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
  
  -- Verify status is valid
  IF p_status NOT IN ('confirmed', 'shipped', 'delivered', 'cancelled') THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', format('Invalid order status: %s', p_status)
    );
  END IF;
  
  -- For security, prevent changing status for orders in payment flow
  IF v_old_status IN ('draft', 'pending_payment') THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', format('Cannot modify orders in %s status. Order must complete payment process first.', v_old_status),
      'order_id', p_order_id
    );
  END IF;

  -- Update order status for post-payment status changes only
  UPDATE orders
  SET 
    status = p_status::order_status_enum,
    updated_at = now()
  WHERE id = p_order_id
  AND status::text NOT IN ('draft', 'pending_payment');

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
  -- This is now just a wrapper around merchant_update_order_status
  -- for backward compatibility
  RETURN merchant_update_order_status(p_order_id, p_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or update the validate_order_status_transition function to ensure proper flow
CREATE OR REPLACE FUNCTION validate_order_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow any transition from NULL (new order)
  IF OLD.status IS NULL THEN
    RETURN NEW;
  END IF;

  -- Define valid transitions
  -- Payment-related transitions (strict, only allowed by system_update_order_status)
  IF (OLD.status = 'draft' AND NEW.status = 'pending_payment') OR
     (OLD.status = 'pending_payment' AND NEW.status = 'confirmed') OR
     (OLD.status = 'pending_payment' AND NEW.status = 'cancelled') OR
     (OLD.status = 'draft' AND NEW.status = 'cancelled') OR
     -- Post-payment transitions (flexible, allowed by merchant_update_order_status)
     (OLD.status = 'confirmed' AND NEW.status IN ('shipped', 'delivered', 'cancelled')) OR
     (OLD.status = 'shipped' AND NEW.status IN ('confirmed', 'delivered', 'cancelled')) OR
     (OLD.status = 'delivered' AND NEW.status IN ('cancelled', 'shipped', 'confirmed')) OR
     -- Allow same status (no change)
     (OLD.status = NEW.status) THEN
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
  EXECUTE FUNCTION validate_order_status_transition();

-- Revoke execution permissions on status update functions from authenticated users
-- and grant them only to service_role
REVOKE EXECUTE ON FUNCTION update_order_transaction(uuid, text, numeric) FROM authenticated;
REVOKE EXECUTE ON FUNCTION confirm_order_transaction(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION confirm_order_payment(TEXT, TEXT) FROM authenticated;

-- Grant execution permissions to service_role
GRANT EXECUTE ON FUNCTION update_order_transaction(uuid, text, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION confirm_order_transaction(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION confirm_order_payment(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION system_update_order_status(UUID, TEXT) TO service_role;

-- Grant merchant functions to authenticated users
GRANT EXECUTE ON FUNCTION merchant_update_order_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION update_order_status(uuid, text) TO authenticated;

COMMIT; 