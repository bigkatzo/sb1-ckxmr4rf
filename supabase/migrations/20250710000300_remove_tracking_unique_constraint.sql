-- Remove unique constraint on tracking numbers to allow multiple orders to use the same tracking
BEGIN;

-- Drop the existing unique constraint on order_id and tracking_number
ALTER TABLE order_tracking DROP CONSTRAINT IF EXISTS order_tracking_order_id_tracking_number_key;

-- Keep the unique constraint on order_id to ensure one tracking per order
ALTER TABLE order_tracking DROP CONSTRAINT IF EXISTS order_tracking_order_id_key;
ALTER TABLE order_tracking ADD CONSTRAINT order_tracking_order_id_key UNIQUE (order_id);

-- Add an index on tracking_number for faster lookups
DROP INDEX IF EXISTS idx_order_tracking_tracking_number;
CREATE INDEX idx_order_tracking_tracking_number ON order_tracking(tracking_number);

-- Add helpful comment
COMMENT ON TABLE order_tracking IS 'Stores tracking information for orders. Multiple orders can share the same tracking number, but each order can only have one tracking entry.';

COMMIT; 