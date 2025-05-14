-- Start transaction
BEGIN;

-- Create function to update receipt URL for all orders in a batch
CREATE OR REPLACE FUNCTION update_batch_receipt_url(
  p_batch_order_id uuid,
  p_receipt_url text
)
RETURNS void AS $$
DECLARE
  updated_count integer;
BEGIN
  -- Update all orders in the batch with the receipt URL
  -- This ensures all orders in a batch have the same receipt URL
  UPDATE orders
  SET 
    transaction_signature = p_receipt_url,
    updated_at = now()
  WHERE batch_order_id = p_batch_order_id
  AND status = 'confirmed';
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;

  -- Log the number of updated orders but don't fail if none
  RAISE NOTICE 'Updated % orders with receipt URL in batch %', updated_count, p_batch_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION update_batch_receipt_url(uuid, text) TO authenticated, service_role;

-- Add comment to explain the function
COMMENT ON FUNCTION update_batch_receipt_url IS 'Updates all orders in a batch with the same receipt URL';

COMMIT; 