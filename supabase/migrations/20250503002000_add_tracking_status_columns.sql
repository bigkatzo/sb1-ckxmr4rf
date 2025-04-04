-- Add tracking status columns to orders table
BEGIN;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS tracking_status text,
ADD COLUMN IF NOT EXISTS tracking_details text;

-- Update RLS policies to allow these columns to be updated by the tracking webhook
CREATE POLICY "Allow tracking webhook to update tracking status"
ON orders
FOR UPDATE
USING (true)
WITH CHECK (
  -- Only allow updating tracking_status and tracking_details
  (
    OLD.tracking_number = NEW.tracking_number AND
    OLD.order_number = NEW.order_number AND
    OLD.collection_id = NEW.collection_id AND
    OLD.product_id = NEW.product_id AND
    OLD.wallet_address = NEW.wallet_address AND
    OLD.transaction_signature = NEW.transaction_signature AND
    OLD.shipping_address = NEW.shipping_address AND
    OLD.contact_info = NEW.contact_info AND
    OLD.amount_sol = NEW.amount_sol AND
    OLD.created_at = NEW.created_at AND
    OLD.variant_selections = NEW.variant_selections
  ) OR (
    -- Or if it's a status update along with tracking details
    OLD.tracking_number = NEW.tracking_number AND
    NEW.status IN ('shipped', 'delivered')
  )
);

COMMIT; 