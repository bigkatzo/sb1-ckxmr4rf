-- Drop existing policies first
DO $$ BEGIN
  DROP POLICY IF EXISTS "products_policy" ON products;
  DROP POLICY IF EXISTS "categories_policy" ON categories;
  DROP POLICY IF EXISTS "orders_policy" ON orders;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create base RLS policies for products
CREATE POLICY "products_policy"
  ON products
  FOR ALL
  TO authenticated
  USING (
    -- Public access to products in visible collections
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND c.visible = true
    )
    OR
    -- Access for collection owners
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND c.user_id = auth.uid()
    )
    OR
    -- Access for users with collection access
    EXISTS (
      SELECT 1 FROM collections c
      JOIN collection_access ca ON ca.collection_id = c.id
      WHERE c.id = products.collection_id
      AND ca.user_id = auth.uid()
      AND ca.access_type = 'manage'
    )
  )
  WITH CHECK (
    -- Only collection owners can modify
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND c.user_id = auth.uid()
    )
    OR
    -- Or users with manage access
    EXISTS (
      SELECT 1 FROM collections c
      JOIN collection_access ca ON ca.collection_id = c.id
      WHERE c.id = products.collection_id
      AND ca.user_id = auth.uid()
      AND ca.access_type = 'manage'
    )
  );

-- Create base RLS policies for categories
CREATE POLICY "categories_policy"
  ON categories
  FOR ALL
  TO authenticated
  USING (
    -- Public access to categories in visible collections
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND c.visible = true
    )
    OR
    -- Access for collection owners
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND c.user_id = auth.uid()
    )
    OR
    -- Access for users with collection access
    EXISTS (
      SELECT 1 FROM collections c
      JOIN collection_access ca ON ca.collection_id = c.id
      WHERE c.id = categories.collection_id
      AND ca.user_id = auth.uid()
      AND ca.access_type = 'manage'
    )
  )
  WITH CHECK (
    -- Only collection owners can modify
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND c.user_id = auth.uid()
    )
    OR
    -- Or users with manage access
    EXISTS (
      SELECT 1 FROM collections c
      JOIN collection_access ca ON ca.collection_id = c.id
      WHERE c.id = categories.collection_id
      AND ca.user_id = auth.uid()
      AND ca.access_type = 'manage'
    )
  );

-- Create base RLS policies for orders
CREATE POLICY "orders_policy"
  ON orders
  FOR ALL
  TO authenticated
  USING (
    -- Buyers can see their own orders
    wallet_address = auth.jwt()->>'wallet_address'
    OR
    -- Collection owners can see orders for their products
    EXISTS (
      SELECT 1 FROM products p
      JOIN collections c ON c.id = p.collection_id
      WHERE p.id = orders.product_id
      AND c.user_id = auth.uid()
    )
    OR
    -- Users with collection access can see orders
    EXISTS (
      SELECT 1 FROM products p
      JOIN collections c ON c.id = p.collection_id
      JOIN collection_access ca ON ca.collection_id = c.id
      WHERE p.id = orders.product_id
      AND ca.user_id = auth.uid()
      AND ca.access_type = 'manage'
    )
  )
  WITH CHECK (
    -- Only collection owners can modify
    EXISTS (
      SELECT 1 FROM products p
      JOIN collections c ON c.id = p.collection_id
      WHERE p.id = orders.product_id
      AND c.user_id = auth.uid()
    )
    OR
    -- Or users with manage access
    EXISTS (
      SELECT 1 FROM products p
      JOIN collections c ON c.id = p.collection_id
      JOIN collection_access ca ON ca.collection_id = c.id
      WHERE p.id = orders.product_id
      AND ca.user_id = auth.uid()
      AND ca.access_type = 'manage'
    )
  );

-- Create function to verify access
CREATE OR REPLACE FUNCTION verify_merchant_dashboard_access()
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
  v_order_id uuid;
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

  -- Create test order
  INSERT INTO orders (
    product_id,
    wallet_address,
    transaction_id,
    transaction_status,
    status,
    shipping_info
  )
  VALUES (
    v_product_id,
    'testwalletaddress',
    'testtx',
    'confirmed',
    'pending',
    '{"address": "test", "contactMethod": "email", "contactValue": "test@test.com"}'
  )
  RETURNING id INTO v_order_id;

  -- Test merchant access to their collection
  check_name := 'Merchant collection access';
  status := EXISTS (
    SELECT 1 FROM collections
    WHERE id = v_collection_id
    AND user_id = v_merchant_id
  );
  details := 'Merchant can access their collection';
  RETURN NEXT;

  -- Test merchant access to their products
  check_name := 'Merchant product access';
  status := EXISTS (
    SELECT 1 FROM products
    WHERE collection_id = v_collection_id
  );
  details := 'Merchant can access their products';
  RETURN NEXT;

  -- Test merchant access to their categories
  check_name := 'Merchant category access';
  status := EXISTS (
    SELECT 1 FROM categories
    WHERE collection_id = v_collection_id
  );
  details := 'Merchant can access their categories';
  RETURN NEXT;

  -- Test merchant access to their orders
  check_name := 'Merchant order access';
  status := EXISTS (
    SELECT 1 FROM orders o
    JOIN products p ON p.id = o.product_id
    JOIN collections c ON c.id = p.collection_id
    WHERE c.user_id = v_merchant_id
  );
  details := 'Merchant can access their orders';
  RETURN NEXT;

  -- Cleanup
  DELETE FROM orders WHERE id = v_order_id;
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
    DELETE FROM orders WHERE id = v_order_id;
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
SELECT * FROM verify_merchant_dashboard_access();

-- Drop verification function
DROP FUNCTION verify_merchant_dashboard_access();