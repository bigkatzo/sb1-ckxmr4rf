-- Add tracking history table
BEGIN;

-- Create tracking_history table
CREATE TABLE IF NOT EXISTS tracking_history (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  tracking_number text NOT NULL,
  status text NOT NULL,
  status_detail text,
  message text,
  location text,
  timestamp timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tracking_number) REFERENCES orders(tracking_number) ON DELETE CASCADE
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tracking_history_tracking_number ON tracking_history(tracking_number);
CREATE INDEX IF NOT EXISTS idx_tracking_history_timestamp ON tracking_history(timestamp);

-- Create unique constraint to prevent duplicate events
CREATE UNIQUE INDEX IF NOT EXISTS idx_tracking_history_unique_event 
ON tracking_history(tracking_number, timestamp);

-- Add RLS policies
ALTER TABLE tracking_history ENABLE ROW LEVEL SECURITY;

-- Allow users to view tracking history for their orders
CREATE POLICY "Users can view tracking history for their orders"
ON tracking_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.tracking_number = tracking_history.tracking_number
    AND o.wallet_address = auth.uid()
  )
);

-- Allow collection owners and admins to view tracking history
CREATE POLICY "Collection owners and admins can view tracking history"
ON tracking_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM orders o
    JOIN collections c ON c.id = o.collection_id
    WHERE o.tracking_number = tracking_history.tracking_number
    AND (
      c.user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM user_profiles up
        WHERE up.id = auth.uid()
        AND up.role = 'admin'
      )
    )
  )
);

-- Allow tracking webhook to insert tracking history
CREATE POLICY "Allow tracking webhook to insert tracking history"
ON tracking_history
FOR INSERT
WITH CHECK (true);

-- Add estimated_delivery_date column to orders if it doesn't exist
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS estimated_delivery_date timestamptz;

COMMIT; 