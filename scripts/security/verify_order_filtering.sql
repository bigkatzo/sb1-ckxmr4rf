-- Test script to verify order filtering is working correctly
-- This script tests that users can only see their own orders

-- Setup test variables
DO $$
DECLARE
  test_wallet_address text := 'test-wallet-1';
  other_wallet_address text := 'test-wallet-2';
  test_order_id uuid;
  other_order_id uuid;
  visible_orders int;
  wrong_wallet_orders int;
BEGIN
  -- Create test orders for two different wallets if they don't exist
  -- First order for test wallet
  INSERT INTO orders (
    collection_id, 
    product_id, 
    wallet_address, 
    transaction_signature, 
    shipping_address, 
    contact_info, 
    status, 
    amount_sol,
    order_number
  )
  SELECT 
    (SELECT id FROM collections LIMIT 1),
    (SELECT id FROM products LIMIT 1),
    test_wallet_address,
    'test-sig-1',
    '{"address": "123 Test St", "city": "Test City", "country": "Test Country", "zip": "12345"}'::jsonb,
    '{"firstName": "Test", "lastName": "User", "method": "email", "value": "test@example.com"}'::jsonb,
    'confirmed',
    1.0,
    'TEST-ORDER-1'
  WHERE NOT EXISTS (
    SELECT 1 FROM orders WHERE wallet_address = test_wallet_address
  )
  RETURNING id INTO test_order_id;
  
  -- Second order for other wallet
  INSERT INTO orders (
    collection_id, 
    product_id, 
    wallet_address, 
    transaction_signature, 
    shipping_address, 
    contact_info, 
    status, 
    amount_sol,
    order_number
  )
  SELECT 
    (SELECT id FROM collections LIMIT 1),
    (SELECT id FROM products LIMIT 1),
    other_wallet_address,
    'test-sig-2',
    '{"address": "456 Other St", "city": "Other City", "country": "Other Country", "zip": "54321"}'::jsonb,
    '{"firstName": "Other", "lastName": "User", "method": "email", "value": "other@example.com"}'::jsonb,
    'confirmed',
    2.0,
    'TEST-ORDER-2'
  WHERE NOT EXISTS (
    SELECT 1 FROM orders WHERE wallet_address = other_wallet_address
  )
  RETURNING id INTO other_order_id;

  -- Find order IDs if they weren't just created
  IF test_order_id IS NULL THEN
    SELECT id INTO test_order_id FROM orders WHERE wallet_address = test_wallet_address LIMIT 1;
  END IF;
  
  IF other_order_id IS NULL THEN
    SELECT id INTO other_order_id FROM orders WHERE wallet_address = other_wallet_address LIMIT 1;
  END IF;
  
  RAISE NOTICE 'Testing with orders: % (wallet: %), % (wallet: %)', 
    test_order_id, test_wallet_address, other_order_id, other_wallet_address;

  -- Test 1: Database table access with row-level security
  RAISE NOTICE '--- Testing database table access with RLS ---';
  
  -- Set auth context to test wallet
  PERFORM set_config('request.jwt.claims', json_build_object('wallet_address', test_wallet_address)::text, true);
  
  -- Count orders visible to this user (should only be their own)
  SELECT count(*) INTO visible_orders FROM orders;
  SELECT count(*) INTO wrong_wallet_orders FROM orders WHERE wallet_address = other_wallet_address;
  
  RAISE NOTICE 'User with wallet % can see % total orders', test_wallet_address, visible_orders;
  RAISE NOTICE 'User with wallet % can see % orders belonging to wallet %', 
    test_wallet_address, wrong_wallet_orders, other_wallet_address;
    
  -- Verify only the correct orders are visible
  IF visible_orders > 0 AND wrong_wallet_orders = 0 THEN
    RAISE NOTICE 'TEST PASSED: RLS is working, user can only see their own orders';
  ELSE
    RAISE WARNING 'TEST FAILED: RLS is not working correctly';
  END IF;
  
  -- Test 2: View based access
  RAISE NOTICE '--- Testing view-based access ---';
  
  -- Count orders visible to this user through the view (should only be their own)
  SELECT count(*) INTO visible_orders FROM user_orders;
  SELECT count(*) INTO wrong_wallet_orders FROM user_orders WHERE wallet_address = other_wallet_address;
  
  RAISE NOTICE 'User with wallet % can see % orders through user_orders view', test_wallet_address, visible_orders;
  RAISE NOTICE 'User with wallet % can see % orders belonging to wallet % through user_orders view', 
    test_wallet_address, wrong_wallet_orders, other_wallet_address;
    
  -- Verify only the correct orders are visible
  IF visible_orders > 0 AND wrong_wallet_orders = 0 THEN
    RAISE NOTICE 'TEST PASSED: View filtering is working, user can only see their own orders';
  ELSE
    RAISE WARNING 'TEST FAILED: View filtering is not working correctly';
  END IF;
  
  -- Test with the other wallet
  RAISE NOTICE '--- Testing with different wallet ---';
  PERFORM set_config('request.jwt.claims', json_build_object('wallet_address', other_wallet_address)::text, true);
  
  -- Count orders visible to this user (should only be their own)
  SELECT count(*) INTO visible_orders FROM orders;
  SELECT count(*) INTO wrong_wallet_orders FROM orders WHERE wallet_address = test_wallet_address;
  
  RAISE NOTICE 'User with wallet % can see % total orders', other_wallet_address, visible_orders;
  RAISE NOTICE 'User with wallet % can see % orders belonging to wallet %', 
    other_wallet_address, wrong_wallet_orders, test_wallet_address;
    
  -- Verify only the correct orders are visible for the other wallet
  IF visible_orders > 0 AND wrong_wallet_orders = 0 THEN
    RAISE NOTICE 'TEST PASSED: RLS is working for other wallet too';
  ELSE
    RAISE WARNING 'TEST FAILED: RLS is not working correctly for other wallet';
  END IF;
  
  -- Summary
  RAISE NOTICE '--- Test Summary ---';
  RAISE NOTICE 'The implementation now has three layers of security:';
  RAISE NOTICE '1. Database RLS policies that filter orders by wallet address';
  RAISE NOTICE '2. User_orders view that explicitly filters by wallet address';
  RAISE NOTICE '3. Client-side filtering in the useOrders hook';
END $$; 