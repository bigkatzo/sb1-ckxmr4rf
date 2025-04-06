-- Start transaction
BEGIN;

-- Update the update_stripe_payment_signature function to handle receipt URLs
CREATE OR REPLACE FUNCTION public.update_stripe_payment_signature(
  p_payment_id text,
  p_charge_id text,
  p_receipt_url text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Store the payment intent ID in metadata before replacing it with receipt URL
  UPDATE orders
  SET 
    transaction_signature = p_receipt_url,
    payment_metadata = jsonb_set(
      jsonb_set(
        coalesce(payment_metadata, '{}'::jsonb),
        '{charge_id}',
        to_jsonb(p_charge_id)
      ),
      '{payment_intent_id}',
      to_jsonb(p_payment_id)
    ),
    updated_at = now()
  WHERE transaction_signature = p_payment_id
    AND transaction_signature LIKE 'pi_%';  -- Only update Stripe payments (Payment Intent IDs)
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.update_stripe_payment_signature(text, text, text) TO authenticated, anon, service_role;

COMMIT; 