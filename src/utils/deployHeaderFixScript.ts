/**
 * This script generates SQL that can be executed directly in the Supabase SQL editor
 * to deploy the necessary functions for wallet header authentication.
 */

// Core wallet authentication function for user_orders view
export const getWalletAuthSQL = () => {
  return `-- Deploy wallet header authentication function
-- Run this in Supabase SQL Editor

-- Create a simple wallet auth check function that uses both methods
CREATE OR REPLACE FUNCTION auth.wallet_matches(check_wallet text) 
RETURNS boolean AS $$
DECLARE
  header_wallet text;
  header_token text;
  jwt_wallet text;
BEGIN
  -- Check for wallet in headers (method 1)
  BEGIN
    header_wallet := current_setting('request.headers.x-wallet-address', true);
    header_token := current_setting('request.headers.x-wallet-auth-token', true);
  EXCEPTION 
    WHEN OTHERS THEN 
      header_wallet := null;
      header_token := null;
  END;

  -- Check for wallet in JWT (method 2)
  BEGIN
    jwt_wallet := auth.jwt()->>'wallet_address';
  EXCEPTION 
    WHEN OTHERS THEN
      jwt_wallet := null;
  END;
  
  -- Allow if wallet matches either method
  RETURN (header_wallet = check_wallet AND header_token IS NOT NULL) OR 
         (jwt_wallet = check_wallet);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION auth.wallet_matches(text) TO authenticated, anon;

-- Update the order policy to use this function
DROP POLICY IF EXISTS "orders_user_view" ON orders;

CREATE POLICY "orders_user_view"
ON orders
FOR SELECT
TO authenticated
USING (
  -- Use the authentication function
  auth.wallet_matches(wallet_address)
);

-- Create a very simple test function
CREATE OR REPLACE FUNCTION test_wallet_header_auth() 
RETURNS jsonb AS $$
DECLARE
  header_wallet text;
  jwt_wallet text;
  has_token boolean;
BEGIN
  -- Try to get headers
  BEGIN
    header_wallet := current_setting('request.headers.x-wallet-address', true);
    has_token := current_setting('request.headers.x-wallet-auth-token', true) IS NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    header_wallet := null;
    has_token := false;
  END;
  
  -- Try to get JWT wallet
  BEGIN
    jwt_wallet := auth.jwt()->>'wallet_address';
  EXCEPTION WHEN OTHERS THEN
    jwt_wallet := null;
  END;
  
  -- Return result
  RETURN jsonb_build_object(
    'header_wallet', header_wallet,
    'has_token', has_token,
    'jwt_wallet', jwt_wallet,
    'role', current_user,
    'timestamp', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION test_wallet_header_auth() TO authenticated, anon;`;
};

// Usage instructions for the frontend team
export const getInstructionsForDeployment = () => {
  return `
To deploy the wallet header authentication fix:

1. Go to your Supabase project dashboard
2. Click on "SQL Editor" in the left navigation
3. Create a new query
4. Paste the SQL code below
5. Execute the query

This will update the authentication function that checks for wallet addresses in both 
HTTP headers and JWT tokens, making it work with both authentication methods.
`;
};

// Helper to get both SQL and instructions
export const getDeploymentHelp = () => {
  return {
    instructions: getInstructionsForDeployment(),
    sql: getWalletAuthSQL()
  };
};

export default getDeploymentHelp; 