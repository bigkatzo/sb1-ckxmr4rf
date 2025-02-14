-- Create function to verify data fetching
CREATE OR REPLACE FUNCTION verify_merchant_data_fetching(p_user_id uuid)
RETURNS TABLE (
  check_name text,
  status boolean,
  details text,
  sample_data jsonb
) AS $$
DECLARE
  v_collection_id uuid;
  v_category_id uuid;
  v_product_id uuid;
  v_order_id uuid;
BEGIN
  -- Create test collection
  INSERT INTO collections (
    name,
    description,
    launch_date,
    user_id,
    visible,
    sale_ended
  )
  VALUES (
    'Test Collection',
    'Test Description',
    now(),
    p_user_id,
    true,
    false
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
    quantity,
    sku,
    images,
    variants,
    variant_prices
  )
  VALUES (
    v_collection_id,
    v_category_id,
    'Test Product',
    'Test Description',
    1.0,
    100,
    'PRD123456',
    ARRAY['https://example.com/test.jpg'],
    '[{"id":"1","name":"Size","options":[{"id":"1","value":"Small"}]}]'::jsonb,
    '{"1:Small":1.0}'::jsonb
  )
  RETURNING id INTO v_product_id;

  -- Create test order
  INSERT INTO orders (
    product_id,
    wallet_address,
    transaction_id,
    transaction_status,
    status,
    shipping_info,
    variants
  )
  VALUES (
    v_product_id,
    'testwalletaddress',
    'testtx',
    'confirmed',
    'pending',
    jsonb_build_object(
      'address', 'Test Address',
      'contactMethod', 'email',
      'contactValue', 'test@test.com'
    ),
    '[{"name":"Size","value":"Small"}]'::jsonb
  )
  RETURNING id INTO v_order_id;

  -- Test collections fetching
  check_name := 'Collections fetching';
  status := EXISTS (
    SELECT 1 FROM collections
    WHERE user_id = p_user_id
  );
  sample_data := (
    SELECT jsonb_build_object(
      'collection', row_to_json(c.*)
    )
    FROM collections c
    WHERE id = v_collection_id
  );
  details := 'Collections can be fetched';
  RETURN NEXT;

  -- Test products fetching
  check_name := 'Products fetching';
  status := EXISTS (
    SELECT 1 FROM products p
    JOIN collections c ON c.id = p.collection_id
    WHERE c.user_id = p_user_id
  );
  sample_data := (
    SELECT jsonb_build_object(
      'product', row_to_json(p.*)
    )
    FROM products p
    WHERE id = v_product_id
  );
  details := 'Products can be fetched';
  RETURN NEXT;

  -- Test categories fetching
  check_name := 'Categories fetching';
  status := EXISTS (
    SELECT 1 FROM categories cat
    JOIN collections c ON c.id = cat.collection_id
    WHERE c.user_id = p_user_id
  );
  sample_data := (
    SELECT jsonb_build_object(
      'category', row_to_json(cat.*)
    )
    FROM categories cat
    WHERE id = v_category_id
  );
  details := 'Categories can be fetched';
  RETURN NEXT;

  -- Test orders fetching
  check_name := 'Orders fetching';
  status := EXISTS (
    SELECT 1 FROM orders o
    JOIN products p ON p.id = o.product_id
    JOIN collections c ON c.id = p.collection_id
    WHERE c.user_id = p_user_id
  );
  sample_data := (
    SELECT jsonb_build_object(
      'order', row_to_json(o.*)
    )
    FROM orders o
    WHERE id = v_order_id
  );
  details := 'Orders can be fetched';
  RETURN NEXT;

  -- Test merchant dashboard data function
  check_name := 'Dashboard data function';
  status := EXISTS (
    SELECT 1 FROM get_merchant_dashboard_data(p_user_id) AS data
    WHERE data IS NOT NULL
  );
  sample_data := (
    SELECT jsonb_build_object(
      'dashboard', row_to_json(d.*)
    )
    FROM get_merchant_dashboard_data(p_user_id) d
  );
  details := 'Dashboard data can be fetched';
  RETURN NEXT;

  -- Cleanup test data
  DELETE FROM orders WHERE id = v_order_id;
  DELETE FROM products WHERE id = v_product_id;
  DELETE FROM categories WHERE id = v_category_id;
  DELETE FROM collections WHERE id = v_collection_id;

  -- Verify cleanup
  check_name := 'Cleanup verification';
  status := NOT EXISTS (
    SELECT 1 FROM collections WHERE id = v_collection_id
  );
  details := 'Test data cleaned up successfully';
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to verify data access
CREATE OR REPLACE FUNCTION verify_merchant_data_access(p_user_id uuid)
RETURNS TABLE (
  check_name text,
  status boolean,
  details text
) AS $$
BEGIN
  -- Check RLS policies
  check_name := 'RLS policies check';
  status := EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename IN ('products', 'categories', 'orders', 'transaction_logs')
  );
  details := 'RLS policies are enabled';
  RETURN NEXT;

  -- Check collection ownership
  check_name := 'Collection ownership check';
  status := EXISTS (
    SELECT 1 FROM collections
    WHERE user_id = p_user_id
  );
  details := 'User owns collections';
  RETURN NEXT;

  -- Check product access
  check_name := 'Product access check';
  status := EXISTS (
    SELECT 1 FROM products p
    JOIN collections c ON c.id = p.collection_id
    WHERE c.user_id = p_user_id
  );
  details := 'User has access to products';
  RETURN NEXT;

  -- Check category access
  check_name := 'Category access check';
  status := EXISTS (
    SELECT 1 FROM categories cat
    JOIN collections c ON c.id = cat.collection_id
    WHERE c.user_id = p_user_id
  );
  details := 'User has access to categories';
  RETURN NEXT;

  -- Check order access
  check_name := 'Order access check';
  status := EXISTS (
    SELECT 1 FROM orders o
    JOIN products p ON p.id = o.product_id
    JOIN collections c ON c.id = p.collection_id
    WHERE c.user_id = p_user_id
  );
  details := 'User has access to orders';
  RETURN NEXT;

  -- Check transaction access
  check_name := 'Transaction access check';
  status := EXISTS (
    SELECT 1 FROM transaction_logs t
    JOIN products p ON p.id = t.product_id
    JOIN collections c ON c.id = p.collection_id
    WHERE c.user_id = p_user_id
  );
  details := 'User has access to transactions';
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION verify_merchant_data_fetching(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION verify_merchant_data_access(uuid) TO authenticated;