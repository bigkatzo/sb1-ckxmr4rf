-- Test script to verify user_orders Row Level Security (RLS) policies
-- This script simulates different user scenarios to ensure our RLS policies are working correctly

-- 1. First, create a test wallet address and order
\set test_wallet_address '\'test-wallet-addr-123\''
\set other_wallet_address '\'other-wallet-addr-456\''

-- 2. Enable tracing for security-related queries
\set VERBOSITY verbose

-- 3. Test as an anonymous user (should see nothing)
-- Reset role to anonymous
RESET ROLE;

-- Try to access orders - this should return no rows
SELECT 'Anonymous user test:' as test;
SELECT count(*) FROM user_orders;

-- 4. Test as authenticated user with a specific wallet address
-- First, set up our test role
DROP ROLE IF EXISTS test_wallet_user;
CREATE ROLE test_wallet_user LOGIN;
GRANT authenticated TO test_wallet_user;

-- Set session variables for JWT claims simulation
SET LOCAL ROLE test_wallet_user;
SET LOCAL "request.jwt.claims" TO '{"wallet_address": ' || :test_wallet_address || '}';

-- Query orders with this user - should only see orders with matching wallet address
SELECT 'Authenticated user with wallet ' || :test_wallet_address || ' test:' as test;
SELECT count(*) as matching_orders FROM user_orders;

-- Verify we can't see orders from other wallets
SELECT 'Check that test user cannot see orders from other wallets:' as test;
SELECT count(*) as should_be_zero FROM user_orders WHERE wallet_address = :other_wallet_address;

-- 5. Test as another wallet user
-- Set up another test role
DROP ROLE IF EXISTS other_wallet_user;
CREATE ROLE other_wallet_user LOGIN;
GRANT authenticated TO other_wallet_user;

-- Set session variables for JWT claims simulation
SET LOCAL ROLE other_wallet_user;
SET LOCAL "request.jwt.claims" TO '{"wallet_address": ' || :other_wallet_address || '}';

-- Query orders with this user - should only see orders with matching wallet address
SELECT 'Authenticated user with wallet ' || :other_wallet_address || ' test:' as test;
SELECT count(*) as matching_orders FROM user_orders;

-- 6. Test as admin
DROP ROLE IF EXISTS admin_user;
CREATE ROLE admin_user LOGIN;
GRANT authenticated TO admin_user;

-- Insert a test admin in user_profiles if needed
SET LOCAL ROLE postgres;
INSERT INTO user_profiles (id, role)
SELECT '00000000-0000-0000-0000-000000000001', 'admin'
WHERE NOT EXISTS (
    SELECT 1 FROM user_profiles WHERE role = 'admin'
);

-- Set session variables for admin
SET LOCAL ROLE admin_user;
SET LOCAL "request.jwt.claims" TO '{"sub": "00000000-0000-0000-0000-000000000001"}';

-- Admin should be able to see all orders via merchant_orders view
SELECT 'Admin user test:' as test;
SELECT count(*) as all_orders FROM merchant_orders;

-- 7. Cleanup test roles
RESET ROLE;
DROP ROLE IF EXISTS test_wallet_user;
DROP ROLE IF EXISTS other_wallet_user;
DROP ROLE IF EXISTS admin_user;

-- 8. Summary
SELECT 'RLS POLICY TEST COMPLETE' as test;
SELECT 'If all tests passed, the RLS policies are configured correctly.' as result;
SELECT 'Check that anonymous users see 0 records, and authenticated users only see their own wallet orders.' as verification; 