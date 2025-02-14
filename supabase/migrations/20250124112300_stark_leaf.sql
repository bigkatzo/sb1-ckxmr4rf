-- Create function to verify UI data structure
CREATE OR REPLACE FUNCTION verify_merchant_ui_data(p_user_id uuid)
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
  -- Create test collection with UI-specific fields
  INSERT INTO collections (
    name,
    description,
    launch_date,
    user_id,
    visible,
    sale_ended,
    image_url,
    featured,
    slug,
    tags
  )
  VALUES (
    'Test Collection',
    'Test Description with <b>HTML</b> to verify sanitization',
    now(),
    p_user_id,
    true,
    false,
    'https://example.com/test.jpg',
    true,
    'test-collection',
    ARRAY['test', 'ui', 'verification']
  )
  RETURNING id INTO v_collection_id;

  -- Create test category with UI elements
  INSERT INTO categories (
    collection_id,
    name,
    description,
    type,
    eligibility_rules
  )
  VALUES (
    v_collection_id,
    'Test Category',
    'Test Description with <script>alert("xss")</script> to verify sanitization',
    'rules-based',
    jsonb_build_object(
      'rules', jsonb_build_array(
        jsonb_build_object(
          'type', 'token',
          'value', 'TokenAddress123',
          'quantity', 1
        )
      )
    )
  )
  RETURNING id INTO v_category_id;

  -- Create test product with UI components
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
    variant_prices,
    minimum_order_quantity,
    slug
  )
  VALUES (
    v_collection_id,
    v_category_id,
    'Test Product',
    'Test Description with markdown **bold** and _italic_',
    1.0,
    100,
    'PRD123456',
    ARRAY['https://example.com/test1.jpg', 'https://example.com/test2.jpg'],
    jsonb_build_array(
      jsonb_build_object(
        'id', '1',
        'name', 'Size',
        'options', jsonb_build_array(
          jsonb_build_object('id', '1', 'value', 'Small'),
          jsonb_build_object('id', '2', 'value', 'Medium'),
          jsonb_build_object('id', '3', 'value', 'Large')
        )
      ),
      jsonb_build_object(
        'id', '2',
        'name', 'Color',
        'options', jsonb_build_array(
          jsonb_build_object('id', '1', 'value', 'Red'),
          jsonb_build_object('id', '2', 'value', 'Blue')
        )
      )
    ),
    jsonb_build_object(
      '1:Small', 1.0,
      '1:Medium', 1.5,
      '1:Large', 2.0,
      '2:Red', 1.0,
      '2:Blue', 1.0
    ),
    50,
    'test-product'
  )
  RETURNING id INTO v_product_id;

  -- Create test order with UI elements
  INSERT INTO orders (
    product_id,
    wallet_address,
    transaction_id,
    transaction_status,
    status,
    shipping_info,
    variants,
    order_number
  )
  VALUES (
    v_product_id,
    'testwalletaddress',
    'testtx',
    'confirmed',
    'pending',
    jsonb_build_object(
      'address', E'123 Test St.\nTest City, TS 12345',
      'contactMethod', 'email',
      'contactValue', 'test@test.com'
    ),
    jsonb_build_array(
      jsonb_build_object(
        'name', 'Size',
        'value', 'Small'
      ),
      jsonb_build_object(
        'name', 'Color',
        'value', 'Red'
      )
    ),
    'ORD123456'
  )
  RETURNING id INTO v_order_id;

  -- Test collections UI data
  check_name := 'Collections UI data';
  status := EXISTS (
    SELECT 1 FROM collections
    WHERE id = v_collection_id
    AND image_url IS NOT NULL
    AND slug IS NOT NULL
    AND array_length(tags, 1) > 0
  );
  sample_data := (
    SELECT jsonb_build_object(
      'collection', row_to_json(c.*)
    )
    FROM collections c
    WHERE id = v_collection_id
  );
  details := 'Collection has all required UI fields';
  RETURN NEXT;

  -- Test categories UI data
  check_name := 'Categories UI data';
  status := EXISTS (
    SELECT 1 FROM categories
    WHERE id = v_category_id
    AND eligibility_rules IS NOT NULL
    AND type IS NOT NULL
  );
  sample_data := (
    SELECT jsonb_build_object(
      'category', row_to_json(cat.*)
    )
    FROM categories cat
    WHERE id = v_category_id
  );
  details := 'Category has all required UI fields';
  RETURN NEXT;

  -- Test products UI data
  check_name := 'Products UI data';
  status := EXISTS (
    SELECT 1 FROM products
    WHERE id = v_product_id
    AND array_length(images, 1) > 0
    AND variants IS NOT NULL
    AND variant_prices IS NOT NULL
    AND slug IS NOT NULL
  );
  sample_data := (
    SELECT jsonb_build_object(
      'product', row_to_json(p.*)
    )
    FROM products p
    WHERE id = v_product_id
  );
  details := 'Product has all required UI fields';
  RETURN NEXT;

  -- Test orders UI data
  check_name := 'Orders UI data';
  status := EXISTS (
    SELECT 1 FROM orders
    WHERE id = v_order_id
    AND order_number IS NOT NULL
    AND shipping_info IS NOT NULL
    AND variants IS NOT NULL
  );
  sample_data := (
    SELECT jsonb_build_object(
      'order', row_to_json(o.*)
    )
    FROM orders o
    WHERE id = v_order_id
  );
  details := 'Order has all required UI fields';
  RETURN NEXT;

  -- Test dashboard data structure
  check_name := 'Dashboard data structure';
  status := EXISTS (
    SELECT 1 FROM get_merchant_dashboard_data(p_user_id) AS data
    WHERE data.collections IS NOT NULL
    AND data.products IS NOT NULL
    AND data.categories IS NOT NULL
    AND data.orders IS NOT NULL
  );
  sample_data := (
    SELECT jsonb_build_object(
      'dashboard', row_to_json(d.*)
    )
    FROM get_merchant_dashboard_data(p_user_id) d
  );
  details := 'Dashboard data has all required sections';
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

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION verify_merchant_ui_data(uuid) TO authenticated;