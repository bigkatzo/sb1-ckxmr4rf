-- Start transaction
BEGIN;

-- Update the confirm_stripe_payment function to remove the non-existent payment_confirmed_at column
CREATE OR REPLACE FUNCTION public.confirm_stripe_payment(
  p_payment_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- First move to pending_payment if in draft
  UPDATE orders
  SET 
    status = 'pending_payment',
    updated_at = now()
  WHERE transaction_signature = p_payment_id
    AND transaction_signature LIKE 'pi_%'  -- Only update Stripe payments
    AND status = 'draft';

  -- Then confirm the payment (without payment_confirmed_at field)
  UPDATE orders
  SET 
    status = 'confirmed',
    updated_at = now()
  WHERE transaction_signature = p_payment_id
    AND transaction_signature LIKE 'pi_%'  -- Only update Stripe payments
    AND status = 'pending_payment';
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.confirm_stripe_payment(text) TO authenticated, anon, service_role;

COMMIT; 