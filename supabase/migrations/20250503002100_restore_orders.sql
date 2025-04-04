-- Restore orders table to original state and create tracking tables
BEGIN;

-- First, drop dependent views and policies
DROP VIEW IF EXISTS merchant_orders CASCADE;
DROP VIEW IF EXISTS user_orders CASCADE;

-- Drop existing policies
DROP POLICY IF EXISTS "Allow tracking webhook to update tracking status" ON orders;

-- First, backup existing tracking data
CREATE TABLE IF NOT EXISTS temp_tracking_backup AS
SELECT 
  id as order_id,
  tracking_number,
  tracking_status as status,
  tracking_details as status_details,
  updated_at
FROM orders 
WHERE tracking_number IS NOT NULL;

-- Remove tracking columns from orders table
ALTER TABLE orders 
  DROP COLUMN IF EXISTS tracking_number,
  DROP COLUMN IF EXISTS tracking_status,
  DROP COLUMN IF EXISTS tracking_details;

-- Create new tracking tables
CREATE TABLE IF NOT EXISTS order_tracking (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id uuid REFERENCES orders(id),
  tracking_number text NOT NULL,
  carrier text DEFAULT 'usps',
  status text,
  status_details text,
  estimated_delivery_date timestamptz,
  last_update timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(order_id, tracking_number)
);

CREATE TABLE IF NOT EXISTS tracking_events (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  tracking_id uuid REFERENCES order_tracking(id),
  status text NOT NULL,
  details text,
  location text,
  timestamp timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_order_tracking_order_id ON order_tracking(order_id);
CREATE INDEX IF NOT EXISTS idx_order_tracking_tracking_number ON order_tracking(tracking_number);
CREATE INDEX IF NOT EXISTS idx_tracking_events_tracking_id ON tracking_events(tracking_id);

-- Migrate existing tracking data
INSERT INTO order_tracking (order_id, tracking_number, status, status_details, last_update, updated_at)
SELECT 
  order_id,
  tracking_number,
  status,
  status_details,
  updated_at,
  updated_at
FROM temp_tracking_backup;

-- Drop temporary backup table
DROP TABLE temp_tracking_backup;

-- Add RLS policies for tracking
ALTER TABLE order_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_events ENABLE ROW LEVEL SECURITY;

-- Policies for order_tracking
CREATE POLICY "Users can view tracking for their orders"
ON order_tracking FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_id
    AND o.wallet_address = auth.jwt()->>'wallet_address'
  )
);

CREATE POLICY "Merchants can manage tracking for their orders"
ON order_tracking FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM orders o
    JOIN collections c ON c.id = o.collection_id
    LEFT JOIN collection_access ca ON ca.collection_id = c.id
    WHERE o.id = order_id
    AND (
      c.user_id = auth.uid()
      OR ca.user_id = auth.uid() AND ca.access_type = 'edit'
      OR EXISTS (
        SELECT 1 FROM user_profiles up
        WHERE up.id = auth.uid()
        AND up.role = 'admin'
      )
    )
  )
);

-- Policies for tracking_events
CREATE POLICY "Anyone can view tracking events"
ON tracking_events FOR SELECT
USING (true);

CREATE POLICY "Only system can insert tracking events"
ON tracking_events FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'admin'
  )
);

-- Grant permissions
GRANT SELECT ON order_tracking TO authenticated;
GRANT SELECT ON tracking_events TO authenticated;

-- Grant additional permissions to service role
GRANT ALL ON order_tracking TO service_role;
GRANT ALL ON tracking_events TO service_role;

COMMIT; 