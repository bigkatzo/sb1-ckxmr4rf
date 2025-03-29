-- Start transaction
BEGIN;

-- Add columns for verified transaction details if they don't exist
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS verified_amount numeric,
ADD COLUMN IF NOT EXISTS verified_buyer_address text,
ADD COLUMN IF NOT EXISTS verified_at timestamptz;

-- Update the confirm_order_payment function to store verified details
CREATE OR REPLACE FUNCTION confirm_order_payment(
  p_transaction_id TEXT,
  p_status TEXT,
  p_verified_details jsonb DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  -- Verify status is valid
  IF p_status NOT IN ('confirmed', 'failed') THEN
    RAISE EXCEPTION 'Invalid transaction status: %', p_status;
  END IF;

  -- Update order status and verified details
  UPDATE orders
  SET 
    transaction_status = p_status,
    status = CASE 
      WHEN p_status = 'confirmed' THEN 'confirmed'
      WHEN p_status = 'failed' THEN 'cancelled'
      ELSE status
    END,
    verified_amount = CASE 
      WHEN p_status = 'confirmed' AND p_verified_details IS NOT NULL 
      THEN (p_verified_details->>'amount')::numeric 
      ELSE NULL 
    END,
    verified_buyer_address = CASE 
      WHEN p_status = 'confirmed' AND p_verified_details IS NOT NULL 
      THEN p_verified_details->>'buyer' 
      ELSE NULL 
    END,
    verified_at = CASE 
      WHEN p_status = 'confirmed' THEN now() 
      ELSE NULL 
    END,
    updated_at = now()
  WHERE transaction_signature = p_transaction_id
  AND status = 'pending_payment';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION confirm_order_payment(TEXT, TEXT, jsonb) TO authenticated;

COMMIT; 