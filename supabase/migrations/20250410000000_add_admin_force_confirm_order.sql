-- Start transaction
BEGIN;

-- Create a new function that uses SECURITY DEFINER to bypass RLS
CREATE OR REPLACE FUNCTION public.admin_force_confirm_order(
  p_order_id uuid,
  p_transaction_signature text
)
RETURNS SETOF orders
LANGUAGE plpgsql
SECURITY DEFINER -- This makes the function run with the privileges of the creator
AS $$
DECLARE
  v_updated_order orders;
BEGIN
  -- Directly update the order status to confirmed regardless of current state
  UPDATE orders
  SET 
    status = 'confirmed',
    transaction_signature = p_transaction_signature,
    updated_at = now()
  WHERE id = p_order_id
  RETURNING * INTO v_updated_order;

  -- Return the updated order
  RETURN QUERY SELECT * FROM v_updated_order;
END;
$$;

-- Grant execute permissions on the function
GRANT EXECUTE ON FUNCTION public.admin_force_confirm_order(uuid, text) TO authenticated, anon, service_role;

-- Also update the update_stripe_webhook.js function to use service role key
COMMENT ON FUNCTION public.admin_force_confirm_order(uuid, text) IS 'Administrative function to force confirm an order, bypassing RLS policies';

COMMIT; 