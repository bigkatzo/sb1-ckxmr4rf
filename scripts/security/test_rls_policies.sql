-- Test script to verify user_orders Row Level Security (RLS) policies
-- This script simulates different user scenarios to ensure our RLS policies are working correctly

-- Replace psql variables with regular SQL variables
DO $$
DECLARE
  test_wallet_address TEXT := 'test-wallet-addr-123';
  other_wallet_address TEXT := 'other-wallet-addr-456';
BEGIN

-- 1. Test as an anonymous user (should see nothing)
RAISE NOTICE 'Anonymous user test:';
-- This part needs to be tested manually by logging out or using anon key

-- 2. Test as authenticated user with a specific wallet address
RAISE NOTICE 'Authenticated user test with wallet %:', test_wallet_address;

-- Insert a test order if none exists for this wallet
INSERT INTO orders (
  id, 
  order_number, 
  wallet_address, 
  status, 
  amount_sol, 
  product_id, 
  collection_id, 
  transaction_signature,
  shipping_address,
  contact_info
)
SELECT 
  '11111111-1111-1111-1111-111111111111', 
  'TEST-ORDER-123', 
  test_wallet_address, 
  'confirmed', 
  1.0,
  -- These need to be valid IDs from your database:
  (SELECT id FROM products LIMIT 1),
  (SELECT id FROM collections LIMIT 1),
  'test-sig-123',
  '{"address": "123 Test St", "city": "Test City", "country": "Test Country", "zip": "12345"}'::jsonb,
  '{"firstName": "Test", "lastName": "User", "method": "email", "value": "test@example.com", "phoneNumber": "123-456-7890"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM orders WHERE wallet_address = test_wallet_address
);

-- Insert a test order for the other wallet too
INSERT INTO orders (
  id, 
  order_number, 
  wallet_address, 
  status, 
  amount_sol, 
  product_id, 
  collection_id, 
  transaction_signature,
  shipping_address,
  contact_info
)
SELECT 
  '22222222-2222-2222-2222-222222222222', 
  'TEST-ORDER-456', 
  other_wallet_address, 
  'confirmed', 
  2.0,
  -- These need to be valid IDs from your database:
  (SELECT id FROM products LIMIT 1),
  (SELECT id FROM collections LIMIT 1),
  'test-sig-456',
  '{"address": "456 Other St", "city": "Other City", "country": "Other Country", "zip": "54321"}'::jsonb,
  '{"firstName": "Other", "lastName": "User", "method": "email", "value": "other@example.com", "phoneNumber": "987-654-3210"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM orders WHERE wallet_address = other_wallet_address
);

-- Now test the policies with different auth contexts
-- First, test with the test wallet
PERFORM set_config('request.jwt.claims', json_build_object('wallet_address', test_wallet_address)::text, true);

-- Count orders visible to this user (should only be their own)
DECLARE
  visible_orders INT;
  wrong_wallet_orders INT;
BEGIN
  SELECT count(*) INTO visible_orders FROM user_orders;
  SELECT count(*) INTO wrong_wallet_orders FROM user_orders WHERE wallet_address = other_wallet_address;
  
  RAISE NOTICE 'User with wallet % can see % orders', test_wallet_address, visible_orders;
  RAISE NOTICE 'User with wallet % can see % orders belonging to wallet %', 
    test_wallet_address, wrong_wallet_orders, other_wallet_address;
    
  -- Verify only the correct orders are visible
  IF visible_orders > 0 AND wrong_wallet_orders = 0 THEN
    RAISE NOTICE 'TEST PASSED: User can only see their own orders';
  ELSE
    RAISE WARNING 'TEST FAILED: User can either see no orders or can see other users'' orders';
  END IF;
END;

-- Now test with the other wallet
PERFORM set_config('request.jwt.claims', json_build_object('wallet_address', other_wallet_address)::text, true);

-- Count orders visible to this user (should only be their own)
DECLARE
  visible_orders INT;
  wrong_wallet_orders INT;
BEGIN
  SELECT count(*) INTO visible_orders FROM user_orders;
  SELECT count(*) INTO wrong_wallet_orders FROM user_orders WHERE wallet_address = test_wallet_address;
  
  RAISE NOTICE 'User with wallet % can see % orders', other_wallet_address, visible_orders;
  RAISE NOTICE 'User with wallet % can see % orders belonging to wallet %', 
    other_wallet_address, wrong_wallet_orders, test_wallet_address;
    
  -- Verify only the correct orders are visible
  IF visible_orders > 0 AND wrong_wallet_orders = 0 THEN
    RAISE NOTICE 'TEST PASSED: User can only see their own orders';
  ELSE
    RAISE WARNING 'TEST FAILED: User can either see no orders or can see other users'' orders';
  END IF;
END;

-- Clean up test data if needed (comment out to keep test data)
-- DELETE FROM orders WHERE wallet_address IN (test_wallet_address, other_wallet_address);

RAISE NOTICE 'RLS POLICY TEST COMPLETE';
RAISE NOTICE 'If all tests passed, the RLS policies are configured correctly.';

END; $$; 