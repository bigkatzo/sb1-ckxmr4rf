-- Start transaction
BEGIN;

-- Drop the existing function first
DROP FUNCTION IF EXISTS public.confirm_stripe_payment(text);

-- Update the confirm_stripe_payment function to handle both direct transaction signatures 
-- and payment_intent_id stored in metadata
CREATE OR REPLACE FUNCTION public.confirm_stripe_payment(
  p_payment_id text
)
RETURNS SETOF orders
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated_rows orders;
  v_metadata_rows orders;
BEGIN
  -- First try the direct transaction_signature approach
  -- Move draft to pending_payment
  UPDATE orders
  SET 
    status = 'pending_payment',
    updated_at = now()
  WHERE transaction_signature = p_payment_id
    AND transaction_signature LIKE 'pi_%'  -- Only update Stripe payments
    AND status = 'draft'
  RETURNING * INTO v_updated_rows;

  -- Move pending_payment to confirmed
  UPDATE orders
  SET 
    status = 'confirmed',
    updated_at = now()
  WHERE transaction_signature = p_payment_id
    AND transaction_signature LIKE 'pi_%'  -- Only update Stripe payments
    AND status = 'pending_payment'
  RETURNING * INTO v_updated_rows;

  -- If no rows were updated via transaction_signature, try to find by payment_intent_id in metadata
  IF v_updated_rows IS NULL THEN
    -- First move draft to pending_payment
    UPDATE orders
    SET 
      status = 'pending_payment',
      updated_at = now()
    WHERE 
      (payment_metadata->>'payment_intent_id' = p_payment_id OR payment_metadata->>'paymentIntentId' = p_payment_id)
      AND status = 'draft'
    RETURNING * INTO v_metadata_rows;

    -- Then move pending_payment to confirmed
    UPDATE orders
    SET 
      status = 'confirmed',
      updated_at = now()
    WHERE 
      (payment_metadata->>'payment_intent_id' = p_payment_id OR payment_metadata->>'paymentIntentId' = p_payment_id)
      AND status = 'pending_payment'
    RETURNING * INTO v_metadata_rows;

    -- Return any rows updated via metadata
    RETURN QUERY SELECT * FROM v_metadata_rows WHERE v_metadata_rows IS NOT NULL;
  ELSE
    -- Return rows updated via transaction_signature
    RETURN QUERY SELECT * FROM v_updated_rows WHERE v_updated_rows IS NOT NULL;
  END IF;

  -- Third attempt: Try to find by any reference to the payment ID in the metadata as a string
  IF v_updated_rows IS NULL AND v_metadata_rows IS NULL THEN
    -- Move draft to pending_payment
    UPDATE orders
    SET 
      status = 'pending_payment',
      updated_at = now()
    WHERE 
      payment_metadata::text LIKE '%' || p_payment_id || '%'
      AND status = 'draft'
    RETURNING * INTO v_metadata_rows;

    -- Move pending_payment to confirmed
    UPDATE orders
    SET 
      status = 'confirmed',
      updated_at = now()
    WHERE 
      payment_metadata::text LIKE '%' || p_payment_id || '%'
      AND status = 'pending_payment'
    RETURNING * INTO v_metadata_rows;

    -- Return any rows updated in the third attempt
    RETURN QUERY SELECT * FROM v_metadata_rows WHERE v_metadata_rows IS NOT NULL;
  END IF;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.confirm_stripe_payment(text) TO authenticated, anon, service_role;

COMMIT; 