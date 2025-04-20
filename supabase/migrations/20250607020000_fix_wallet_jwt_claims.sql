-- Fix wallet-based RLS for orders
BEGIN;

-- Create a function to check if a wallet belongs to the current user or if the wallet address matches the JWT wallet_address claim
CREATE OR REPLACE FUNCTION check_wallet_access(wallet_addr text)
RETURNS boolean AS $$
BEGIN
  -- If there's a wallet_address claim in the JWT, allow direct matching
  IF auth.jwt() ? 'wallet_address' AND auth.jwt()->>'wallet_address' = wallet_addr THEN
    RETURN true;
  END IF;

  -- Also check if the wallet is associated with the current authenticated user
  RETURN EXISTS (
    SELECT 1 
    FROM wallets w 
    WHERE w.user_id = auth.uid() 
    AND w.wallet_address = wallet_addr
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing user orders policy
DROP POLICY IF EXISTS "orders_user_view" ON orders;

-- Create updated policy that uses the new function
CREATE POLICY "orders_user_view"
ON orders
FOR SELECT
TO authenticated
USING (
  -- Check with our new function that validates both JWT claim and wallet association
  check_wallet_access(wallet_address)
);

-- Create a debug function to check wallet authentication
CREATE OR REPLACE FUNCTION debug_auth_jwt()
RETURNS jsonb AS $$
BEGIN
  RETURN jsonb_build_object(
    'uid', auth.uid(),
    'role', auth.role(),
    'jwt_claims', auth.jwt(),
    'has_wallet_claim', auth.jwt() ? 'wallet_address',
    'wallet_from_jwt', auth.jwt()->>'wallet_address',
    'check_wallet_fn_result', CASE 
      WHEN auth.jwt() ? 'wallet_address' THEN check_wallet_access(auth.jwt()->>'wallet_address')
      ELSE false
    END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create diagnostic view for debugging wallet auth issues
CREATE OR REPLACE VIEW debug_wallet_auth AS
SELECT
  auth.jwt() as jwt_claims,
  auth.jwt()->>'wallet_address' as extracted_wallet_address,
  (SELECT COUNT(*) FROM orders WHERE wallet_address = auth.jwt()->>'wallet_address') as direct_orders_count,
  (SELECT COUNT(*) FROM user_orders WHERE wallet_address = auth.jwt()->>'wallet_address') as view_orders_count,
  (SELECT array_agg(DISTINCT wallet_address) FROM orders) as all_wallets_with_orders;

-- Grant permissions
GRANT EXECUTE ON FUNCTION check_wallet_access TO authenticated;
GRANT EXECUTE ON FUNCTION debug_auth_jwt TO authenticated;
GRANT SELECT ON debug_wallet_auth TO authenticated;

COMMIT; 