-- Add tracking status columns to orders table
BEGIN;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS tracking_status text,
ADD COLUMN IF NOT EXISTS tracking_details text;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Allow tracking webhook to update tracking status" ON orders;

-- Create a new policy that allows tracking status updates
CREATE POLICY "Allow tracking webhook to update tracking status"
ON orders
FOR UPDATE
USING (true)
WITH CHECK (
  -- Allow updating tracking status and details when status is shipped or delivered
  status IN ('shipped', 'delivered') AND
  tracking_number IS NOT NULL
);

-- Add an index on tracking_number for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_tracking_number ON orders (tracking_number);

COMMIT; 