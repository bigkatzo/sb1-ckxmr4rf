-- Start transaction
BEGIN;

-- Create function to update transaction for batch orders
CREATE OR REPLACE FUNCTION update_batch_order_transaction(
  p_batch_order_id uuid,
  p_transaction_signature text,
  p_amount_sol numeric
)
RETURNS void AS $$
DECLARE
  updated_count integer;
BEGIN
  -- Update all orders in the batch with transaction details and set status to pending_payment
  UPDATE orders
  SET 
    transaction_signature = CASE 
      WHEN p_transaction_signature = 'rejected' THEN NULL -- Don't store 'rejected' as signature
      ELSE p_transaction_signature
    END,
    amount_sol = p_amount_sol / NULLIF(total_items_in_batch, 0), -- Divide amount among items
    status = 'pending_payment',
    updated_at = now()
  WHERE batch_order_id = p_batch_order_id
  AND status = 'draft';
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;

  -- If no rows were updated, the orders weren't in draft status
  IF updated_count = 0 THEN
    RAISE EXCEPTION 'No orders found in draft status for batch %', p_batch_order_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Modify transaction signature constraint to include batch_order_id
-- First drop the existing constraint
DROP INDEX IF EXISTS orders_transaction_signature_unique;

-- Create new constraint that allows duplicate signatures within the same batch
CREATE UNIQUE INDEX orders_transaction_signature_batch_unique 
ON orders (transaction_signature, COALESCE(batch_order_id, id))
WHERE transaction_signature IS NOT NULL;

-- Create function to confirm transaction for all orders in a batch (pending_payment -> confirmed)
CREATE OR REPLACE FUNCTION confirm_batch_order_transaction(
  p_batch_order_id uuid
)
RETURNS void AS $$
DECLARE
  updated_count integer;
BEGIN
  -- Update all orders in the batch to confirmed status
  UPDATE orders
  SET 
    status = 'confirmed',
    updated_at = now()
  WHERE batch_order_id = p_batch_order_id
  AND status = 'pending_payment';

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  -- If no rows were updated, the orders weren't in pending_payment status
  IF updated_count = 0 THEN
    RAISE EXCEPTION 'No orders found in pending_payment status for batch %', p_batch_order_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION update_batch_order_transaction(uuid, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION confirm_batch_order_transaction(uuid) TO authenticated;

COMMIT; 