-- Update orders RLS policy to use JWT authentication with wallet verification
-- Important: Keep wallet auth completely separate from merchant email/password auth
BEGIN;

-- Create a function to check if the authenticated user is using wallet auth
-- This ensures complete separation from merchant auth flow
CREATE OR REPLACE FUNCTION is_wallet_auth()
RETURNS boolean AS $$
BEGIN
  -- Check if the auth was performed through wallet verification
  -- This metadata flag is only set for wallet-based authentications
  RETURN (auth.jwt() -> 'app_metadata' ->> 'wallet_auth')::boolean IS TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check if the authenticated user owns a wallet
CREATE OR REPLACE FUNCTION auth_wallet_matches(wallet_addr text)
RETURNS boolean AS $$
DECLARE
  auth_wallet text;
BEGIN
  -- First ensure this is wallet auth and not merchant auth
  IF NOT is_wallet_auth() THEN
    RETURN false;
  END IF;
  
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

-- Enable Row Level Security on orders table
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Clean up any existing policies that might conflict
DROP POLICY IF EXISTS "orders_user_view" ON orders;
DROP POLICY IF EXISTS "user_orders_policy" ON orders;
DROP POLICY IF EXISTS "wallet_auth_orders_policy" ON orders;

-- Apply policy to regular orders table for wallet-authenticated users
CREATE POLICY "wallet_auth_orders_policy"
ON orders
FOR SELECT
TO authenticated
USING (
  -- Only match if:
  -- 1. User is authenticated with wallet flow (not merchant flow)
  -- 2. JWT wallet address matches requested wallet
  auth_wallet_matches(wallet_address)
);

-- Note: We don't need to create a new view or apply policies to views
-- The RLS on the orders table will automatically filter data
-- that gets passed to the existing user_orders view

-- Grant permissions
GRANT EXECUTE ON FUNCTION is_wallet_auth() TO authenticated;
GRANT EXECUTE ON FUNCTION auth_wallet_matches(text) TO authenticated;
GRANT SELECT ON user_orders TO authenticated;

-- Add comments
COMMENT ON FUNCTION is_wallet_auth() IS 'Checks if the current authentication was done through the wallet flow and not merchant flow';
COMMENT ON FUNCTION auth_wallet_matches(text) IS 'Checks if the authenticated user owns the specified wallet address (wallet auth flow only)';
COMMENT ON POLICY wallet_auth_orders_policy ON orders IS 'Allows wallet users to access orders only if they have proven ownership of the wallet';

COMMIT; 