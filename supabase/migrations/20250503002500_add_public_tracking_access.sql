-- Add public tracking access policies
BEGIN;

-- Add public access policy for order_tracking
CREATE POLICY "Anyone can view tracking by tracking number"
ON order_tracking
FOR SELECT
USING (true);

-- Grant SELECT permissions to public role
GRANT SELECT ON order_tracking TO anon;
GRANT SELECT ON tracking_events TO anon;

COMMIT; 