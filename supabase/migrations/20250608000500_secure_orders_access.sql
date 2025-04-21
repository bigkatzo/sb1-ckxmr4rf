-- Secure orders table access - require wallet authentication
BEGIN;

-- Remove any existing policies that might allow public access
DROP POLICY IF EXISTS "orders_view" ON orders;
DROP POLICY IF EXISTS "orders_user_view" ON orders;

-- Create a function to check if a request is from a wallet owner
CREATE OR REPLACE FUNCTION is_wallet_owner(wallet_addr text)
RETURNS boolean AS $$
BEGIN
  -- Check if the user has proven ownership of this wallet through our auth system
  -- This is a simplified version for our custom JWT approach
  -- We can still add more sophisticated checks later
  RETURN auth.uid() IS NOT NULL AND (
    wallet_addr = ANY(ARRAY[
      current_setting('request.jwt.claim.wallet_address', true),
      current_setting('request.jwt.claim.user_metadata.wallet_address', true),
      current_setting('request.jwt.claim.app_metadata.wallet_address', true)
    ])
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a secure select policy
CREATE POLICY "orders_wallet_owner_only_view"
ON orders
FOR SELECT
TO authenticated
USING (
  -- Only allow access if the user has proven ownership of the wallet
  is_wallet_owner(wallet_address)
);

-- Explain how to test this policy
COMMENT ON FUNCTION is_wallet_owner(text) IS 'Verifies that the authenticated user has proven ownership of the specified wallet address';
COMMENT ON POLICY orders_wallet_owner_only_view ON orders IS 'Restricts order access to users who have proven ownership of the wallet address through our authentication system';

COMMIT; 