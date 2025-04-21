-- Update orders RLS policy to use JWT authentication with wallet verification
BEGIN;

-- Create a function to check if the authenticated user owns a wallet
CREATE OR REPLACE FUNCTION auth_wallet_matches(wallet_addr text)
RETURNS boolean AS $$
DECLARE
  auth_wallet text;
BEGIN
  -- Check if the user is authenticated
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  
  -- Get the wallet address from user_metadata in the JWT
  auth_wallet := auth.jwt() ->> 'wallet_address';
  
  -- If not found in the main object, try user_metadata
  IF auth_wallet IS NULL THEN
    auth_wallet := (auth.jwt() -> 'user_metadata' ->> 'wallet_address');
  END IF;
  
  -- If not found in user_metadata, try app_metadata
  IF auth_wallet IS NULL THEN
    auth_wallet := (auth.jwt() -> 'app_metadata' ->> 'wallet_address');
  END IF;
  
  -- Compare with the requested wallet
  RETURN auth_wallet = wallet_addr;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the orders policy to use both JWT and the existing request parameter methods
DROP POLICY IF EXISTS "orders_user_view" ON orders;

CREATE POLICY "orders_user_view"
ON orders
FOR SELECT
TO authenticated
USING (
  -- JWT-based authorization (secure) - user has proven wallet ownership
  auth_wallet_matches(wallet_address)
);

-- Grant permissions
GRANT EXECUTE ON FUNCTION auth_wallet_matches(text) TO authenticated;

-- Add comments
COMMENT ON FUNCTION auth_wallet_matches(text) IS 'Checks if the authenticated user owns the specified wallet address';
COMMENT ON POLICY orders_user_view ON orders IS 'Allows access to orders only if the user has proven ownership of the wallet';

COMMIT; 