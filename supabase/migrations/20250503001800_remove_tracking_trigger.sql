-- Start transaction
BEGIN;

-- Drop the restrictive trigger and function
DROP TRIGGER IF EXISTS ensure_tracking_number_only_update ON orders;
DROP FUNCTION IF EXISTS check_tracking_number_only_update();

-- The RLS policies are sufficient for controlling who can update tracking numbers
-- No need for additional trigger-based restrictions

COMMIT; 