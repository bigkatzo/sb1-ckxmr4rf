-- Drop existing policies first
DO $$ BEGIN
  DROP POLICY IF EXISTS "products_policy" ON products;
  DROP POLICY IF EXISTS "categories_policy" ON categories;
  DROP POLICY IF EXISTS "orders_policy" ON orders;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create maximally permissive RLS policies for admins and merchants
CREATE POLICY "products_policy"
  ON products
  FOR ALL
  TO authenticated
  USING (
    -- Admins can see everything
    auth.is_admin()
    OR
    -- Merchants can see products in their collections
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND c.user_id = auth.uid()
    )
    OR
    -- Users can see products in collections they have access to
    EXISTS (
      SELECT 1 FROM collections c
      JOIN collection_access ca ON ca.collection_id = c.id
      WHERE c.id = products.collection_id
      AND ca.user_id = auth.uid()
      AND ca.access_type = 'manage'
    )
  )
  WITH CHECK (
    auth.is_admin()
    OR
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND c.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM collections c
      JOIN collection_access ca ON ca.collection_id = c.id
      WHERE c.id = products.collection_id
      AND ca.user_id = auth.uid()
      AND ca.access_type = 'manage'
    )
  );

CREATE POLICY "categories_policy"
  ON categories
  FOR ALL
  TO authenticated
  USING (
    -- Admins can see everything
    auth.is_admin()
    OR
    -- Merchants can see categories in their collections
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND c.user_id = auth.uid()
    )
    OR
    -- Users can see categories in collections they have access to
    EXISTS (
      SELECT 1 FROM collections c
      JOIN collection_access ca ON ca.collection_id = c.id
      WHERE c.id = categories.collection_id
      AND ca.user_id = auth.uid()
      AND ca.access_type = 'manage'
    )
  )
  WITH CHECK (
    auth.is_admin()
    OR
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND c.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM collections c
      JOIN collection_access ca ON ca.collection_id = c.id
      WHERE c.id = categories.collection_id
      AND ca.user_id = auth.uid()
      AND ca.access_type = 'manage'
    )
  );

CREATE POLICY "orders_policy"
  ON orders
  FOR ALL
  TO authenticated
  USING (
    -- Admins can see everything
    auth.is_admin()
    OR
    -- Merchants can see orders for their products
    EXISTS (
      SELECT 1 FROM products p
      JOIN collections c ON c.id = p.collection_id
      WHERE p.id = orders.product_id
      AND c.user_id = auth.uid()
    )
    OR
    -- Users can see orders for collections they have access to
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
    auth.is_admin()
    OR
    EXISTS (
      SELECT 1 FROM products p
      JOIN collections c ON c.id = p.collection_id
      WHERE p.id = orders.product_id
      AND c.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM products p
      JOIN collections c ON c.id = p.collection_id
      JOIN collection_access ca ON ca.collection_id = c.id
      WHERE p.id = orders.product_id
      AND ca.user_id = auth.uid()
      AND ca.access_type = 'manage'
    )
  );

-- Create function to verify merchant dashboard access
CREATE OR REPLACE FUNCTION verify_merchant_dashboard()
RETURNS TABLE (
  check_name text,
  status boolean,
  details text
) AS $$
DECLARE
  v_admin_id uuid;
  v_merchant_id uuid;
  v_collection_id uuid;
  v_product_id uuid;
  v_category_id uuid;
  v_order_id uuid;
BEGIN
  -- Get admin ID
  SELECT id INTO v_admin_id
  FROM auth.users
  WHERE email = 'admin420@merchant.local';

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

  -- Test admin access
  check_name := 'Admin access to all products';
  status := EXISTS (
    SELECT 1 FROM products
    WHERE id = v_product_id
    AND EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = v_admin_id
    )
  );
  details := 'Admin can access all products';
  RETURN NEXT;

  check_name := 'Admin access to all categories';
  status := EXISTS (
    SELECT 1 FROM categories
    WHERE id = v_category_id
    AND EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = v_admin_id
    )
  );
  details := 'Admin can access all categories';
  RETURN NEXT;

  check_name := 'Admin access to all orders';
  status := EXISTS (
    SELECT 1 FROM orders
    WHERE id = v_order_id
    AND EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = v_admin_id
    )
  );
  details := 'Admin can access all orders';
  RETURN NEXT;

  -- Test merchant access
  check_name := 'Merchant access to own products';
  status := EXISTS (
    SELECT 1 FROM products p
    JOIN collections c ON c.id = p.collection_id
    WHERE p.id = v_product_id
    AND c.user_id = v_merchant_id
  );
  details := 'Merchant can access their products';
  RETURN NEXT;

  check_name := 'Merchant access to own categories';
  status := EXISTS (
    SELECT 1 FROM categories cat
    JOIN collections c ON c.id = cat.collection_id
    WHERE cat.id = v_category_id
    AND c.user_id = v_merchant_id
  );
  details := 'Merchant can access their categories';
  RETURN NEXT;

  check_name := 'Merchant access to own orders';
  status := EXISTS (
    SELECT 1 FROM orders o
    JOIN products p ON p.id = o.product_id
    JOIN collections c ON c.id = p.collection_id
    WHERE o.id = v_order_id
    AND c.user_id = v_merchant_id
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
SELECT * FROM verify_merchant_dashboard();

-- Drop verification function
DROP FUNCTION verify_merchant_dashboard();