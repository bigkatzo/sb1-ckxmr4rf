-- Fix permissions for test_wallet_security function
BEGIN;

-- The proper way to grant permissions to the function with its parameter types
GRANT EXECUTE ON FUNCTION test_wallet_security(text, text) TO authenticated, anon;

COMMIT; 