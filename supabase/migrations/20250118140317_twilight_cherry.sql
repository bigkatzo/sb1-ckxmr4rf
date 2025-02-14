-- Create function to verify merchant data access
CREATE OR REPLACE FUNCTION verify_merchant_data_access()
RETURNS TABLE (
  check_name text,
  status boolean,
  details text
) AS $$
DECLARE
  v_merchant_id uuid;
  v_collection_id uuid;
  v_product_id uuid;
  v_category_id uuid;
BEGIN
  -- Create test merchant
  INSERT INTO auth.users (
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    role
  )
  VALUES (
    'testmerchant@merchant.local',
    crypt('TestPass123!', gen_salt('bf')),
    now(),
    '{"role": "merchant"}'::jsonb,
    '{"role": "merchant"}'::jsonb,
    'authenticated'
  )
  RETURNING id INTO v_merchant_id;

  -- Create test collection
  INSERT INTO collections (
    name,
    description,
    launch_date,
    user_id,
    visible
  )
  VALUES (
    'Test Collection',
    'Test Description',
    now(),
    v_merchant_id,
    true
  )
  RETURNING id INTO v_collection_id;

  -- Create test category
  INSERT INTO categories (
    collection_id,
    name,
    description,
    type
  )
  VALUES (
    v_collection_id,
    'Test Category',
    'Test Description',
    'blank'
  )
  RETURNING id INTO v_category_id;

  -- Create test product
  INSERT INTO products (
    collection_id,
    category_id,
    name,
    description,
    price,
    quantity
  )
  VALUES (
    v_collection_id,
    v_category_id,
    'Test Product',
    'Test Description',
    1.0,
    100
  )
  RETURNING id INTO v_product_id;

  -- Test collection access
  check_name := 'Merchant collection access';
  status := EXISTS (
    SELECT 1 FROM get_merchant_collections(v_merchant_id)
    WHERE id = v_collection_id
  );
  details := 'Merchant can access their collections';
  RETURN NEXT;

  -- Test product access
  check_name := 'Merchant product access';
  status := EXISTS (
    SELECT 1 FROM get_merchant_products(v_merchant_id)
    WHERE id = v_product_id
  );
  details := 'Merchant can access their products';
  RETURN NEXT;

  -- Test category access
  check_name := 'Merchant category access';
  status := EXISTS (
    SELECT 1 FROM get_merchant_categories(v_merchant_id)
    WHERE id = v_category_id
  );
  details := 'Merchant can access their categories';
  RETURN NEXT;

  -- Cleanup
  DELETE FROM products WHERE id = v_product_id;
  DELETE FROM categories WHERE id = v_category_id;
  DELETE FROM collections WHERE id = v_collection_id;
  DELETE FROM auth.users WHERE id = v_merchant_id;

  -- Verify cleanup
  check_name := 'Cleanup verification';
  status := NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id = v_merchant_id
  );
  details := 'Test data cleaned up successfully';
  RETURN NEXT;

EXCEPTION WHEN others THEN
  -- Return error details if any test fails
  status := false;
  details := 'Error: ' || SQLERRM;
  RETURN NEXT;
  
  -- Attempt cleanup on error
  BEGIN
    DELETE FROM products WHERE id = v_product_id;
    DELETE FROM categories WHERE id = v_category_id;
    DELETE FROM collections WHERE id = v_collection_id;
    DELETE FROM auth.users WHERE id = v_merchant_id;
  EXCEPTION WHEN others THEN
    -- Ignore cleanup errors
    NULL;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run verification
SELECT * FROM verify_merchant_data_access();

-- Drop verification function
DROP FUNCTION verify_merchant_data_access();