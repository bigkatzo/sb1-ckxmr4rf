-- Enhance tracking table with additional fields
BEGIN;

-- Add new columns for enhanced tracking information
ALTER TABLE order_tracking
ADD COLUMN IF NOT EXISTS latest_event_info text,
ADD COLUMN IF NOT EXISTS latest_event_time timestamptz,
ADD COLUMN IF NOT EXISTS carrier_details jsonb;

-- Add comments explaining each column
COMMENT ON COLUMN order_tracking.latest_event_info IS 'Latest event description from the tracking provider';
COMMENT ON COLUMN order_tracking.latest_event_time IS 'Timestamp of the latest tracking event from the carrier';
COMMENT ON COLUMN order_tracking.carrier_details IS 'Additional carrier-specific details from 17TRACK API';

-- Update existing records to copy last_update to latest_event_time if not null
UPDATE order_tracking
SET latest_event_time = last_update
WHERE latest_event_time IS NULL AND last_update IS NOT NULL;

COMMIT; 