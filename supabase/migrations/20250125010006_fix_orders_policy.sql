-- Start transaction
BEGIN;

-- Drop existing policy
DROP POLICY IF EXISTS "orders_user_view" ON orders;

-- Create updated policy using JWT wallet address
CREATE POLICY "orders_user_view"
ON orders
FOR SELECT
TO authenticated
USING (
    -- Users can view their own orders by matching wallet address from JWT
    wallet_address = auth.jwt()->>'wallet_address'
);

COMMIT; 