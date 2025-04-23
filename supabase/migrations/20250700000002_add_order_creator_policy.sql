-- Add policy to allow access to orders by their creator
BEGIN;

-- Create a function to check if the current time is within 5 minutes of order creation
-- This helps ensure that only recently created orders can be accessed this way
CREATE OR REPLACE FUNCTION is_recent_order(order_created_at timestamptz)
RETURNS boolean AS $$
BEGIN
  RETURN (EXTRACT(EPOCH FROM (NOW() - order_created_at)) < 300); -- 5 minutes in seconds
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add a policy to allow order creators to access their order immediately after creation
-- This is a safe policy because:
-- 1. It only allows access to orders created in the last 5 minutes
-- 2. It only applies to SELECT operations
-- 3. It requires the wallet address to match
CREATE POLICY "orders_creator_immediate_access"
ON orders
FOR SELECT
TO authenticated, anon
USING (
  wallet_address = current_setting('request.headers.x-wallet-address', true)
  AND
  is_recent_order(created_at)
);

-- Add a comment explaining the policy
COMMENT ON POLICY "orders_creator_immediate_access" ON orders IS 'Allows access to orders immediately after creation for order success flow';

COMMIT; 