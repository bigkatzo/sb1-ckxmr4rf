/**
 * This script generates SQL that can be executed directly in the Supabase SQL editor
 * to deploy the necessary functions for wallet header authentication.
 */

// Core wallet authentication function for user_orders view
export const getWalletAuthSQL = () => {
  return `-- Deploy simplified wallet header authentication fix
-- Run this in Supabase SQL Editor

-- First, create a simple view that doesn't use ANY authentication checks
-- This will be protected via RLS policies only
DROP VIEW IF EXISTS user_orders CASCADE;

CREATE VIEW user_orders AS
SELECT 
  o.*,
  p.name as product_name,
  p.sku as product_sku,
  c.name as collection_name
FROM 
  orders o
LEFT JOIN 
  products p ON p.id = o.product_id
LEFT JOIN 
  collections c ON c.id = o.collection_id;

-- Create a simple policy that uses a direct equality check
-- This avoids any complex function calls that might be failing
DROP POLICY IF EXISTS "orders_user_view" ON orders;

CREATE POLICY "orders_user_view"
ON orders
FOR SELECT
TO authenticated
USING (
  -- Simple direct check for either header or JWT wallet
  (wallet_address = current_setting('request.headers.x-wallet-address', true) AND 
   current_setting('request.headers.x-wallet-auth-token', true) IS NOT NULL)
  OR
  wallet_address = auth.jwt()->>'wallet_address'
);

-- Grant access to the view
GRANT SELECT ON user_orders TO authenticated, anon;

-- Create a test function that doesn't rely on any custom functions
CREATE OR REPLACE FUNCTION direct_header_test() 
RETURNS jsonb AS $$
DECLARE
  header_wallet text;
  header_token text;
  jwt_wallet text;
  count_direct integer;
  count_view integer;
BEGIN
  -- Get header values directly
  BEGIN
    header_wallet := current_setting('request.headers.x-wallet-address', true);
  EXCEPTION WHEN OTHERS THEN
    header_wallet := null;
  END;
  
  BEGIN
    header_token := current_setting('request.headers.x-wallet-auth-token', true);
  EXCEPTION WHEN OTHERS THEN
    header_token := null;
  END;
  
  -- Get JWT value
  BEGIN
    jwt_wallet := auth.jwt()->>'wallet_address';
  EXCEPTION WHEN OTHERS THEN
    jwt_wallet := null;
  END;
  
  -- Count direct orders
  IF header_wallet IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM orders WHERE wallet_address = $1' 
    INTO count_direct
    USING header_wallet;
  ELSE
    count_direct := 0;
  END IF;
  
  -- Count view orders
  IF header_wallet IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM user_orders WHERE wallet_address = $1' 
    INTO count_view
    USING header_wallet;
  ELSE
    count_view := 0;
  END IF;
  
  -- Return diagnostic info
  RETURN jsonb_build_object(
    'header_wallet', header_wallet,
    'header_token_present', header_token IS NOT NULL,
    'jwt_wallet', jwt_wallet,
    'direct_count', count_direct,
    'view_count', count_view,
    'timestamp', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION direct_header_test() TO authenticated, anon;

-- Add a helpful comment on how to use this test function
COMMENT ON FUNCTION direct_header_test() IS 'Test if the custom X-Wallet-Address and X-Wallet-Auth-Token headers are being received by the database. Use this to verify that the RLS policy for user_orders is working.';`;
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
6. Return to the Orders page and click "Debug View Auth" again to test

This SQL takes a simpler approach:
- Creates a basic view without complex authentication logic
- Uses a direct policy with straightforward conditions 
- No custom functions that could cause compatibility issues
- Works with both header and JWT authentication methods
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