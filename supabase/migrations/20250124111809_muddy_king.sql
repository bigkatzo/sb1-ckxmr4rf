-- Drop existing policies first
DO $$ BEGIN
  DROP POLICY IF EXISTS "products_policy" ON products;
  DROP POLICY IF EXISTS "categories_policy" ON categories;
  DROP POLICY IF EXISTS "orders_policy" ON orders;
  DROP POLICY IF EXISTS "transactions_policy" ON transaction_logs;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create super simple admin check function
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'email', '') = 'admin420@merchant.local';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check merchant access
CREATE OR REPLACE FUNCTION auth.has_merchant_access()
RETURNS boolean AS $$
BEGIN
  -- Check if user is admin first
  IF auth.is_admin() THEN
    RETURN true;
  END IF;

  -- Check user metadata for merchant role
  RETURN (
    SELECT raw_app_meta_data->>'role' = 'merchant'
    FROM auth.users
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RLS policies for products
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
    -- Collection owners can access their products
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND c.user_id = auth.uid()
    )
    OR
    -- Admin can access everything
    auth.is_admin()
  )
  WITH CHECK (
    -- Only collection owners and admin can modify
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND (c.user_id = auth.uid() OR auth.is_admin())
    )
  );

-- Create RLS policies for categories
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
    -- Collection owners can access their categories
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND c.user_id = auth.uid()
    )
    OR
    -- Admin can access everything
    auth.is_admin()
  )
  WITH CHECK (
    -- Only collection owners and admin can modify
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND (c.user_id = auth.uid() OR auth.is_admin())
    )
  );

-- Create RLS policies for orders
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
    -- Admin can see everything
    auth.is_admin()
  )
  WITH CHECK (
    -- Only collection owners and admin can modify
    EXISTS (
      SELECT 1 FROM products p
      JOIN collections c ON c.id = p.collection_id
      WHERE p.id = orders.product_id
      AND (c.user_id = auth.uid() OR auth.is_admin())
    )
  );

-- Create RLS policies for transaction logs
CREATE POLICY "transactions_policy"
  ON transaction_logs
  FOR ALL
  TO authenticated
  USING (
    -- Buyers can see their own transactions
    buyer_address = auth.jwt()->>'wallet_address'
    OR
    -- Collection owners can see transactions for their products
    EXISTS (
      SELECT 1 FROM products p
      JOIN collections c ON c.id = p.collection_id
      WHERE p.id = transaction_logs.product_id
      AND c.user_id = auth.uid()
    )
    OR
    -- Admin can see everything
    auth.is_admin()
  )
  WITH CHECK (
    -- Only collection owners and admin can modify
    EXISTS (
      SELECT 1 FROM products p
      JOIN collections c ON c.id = p.collection_id
      WHERE p.id = transaction_logs.product_id
      AND (c.user_id = auth.uid() OR auth.is_admin())
    )
  );

-- Create function to verify merchant dashboard access
CREATE OR REPLACE FUNCTION verify_merchant_access(p_user_id uuid)
RETURNS TABLE (
  check_name text,
  status boolean,
  details text
) AS $$
BEGIN
  -- Check admin access
  check_name := 'Admin access check';
  status := EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = p_user_id
    AND email = 'admin420@merchant.local'
  );
  details := 'User has admin access';
  RETURN NEXT;

  -- Check merchant role
  check_name := 'Merchant role check';
  status := EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = p_user_id
    AND raw_app_meta_data->>'role' = 'merchant'
  );
  details := 'User has merchant role';
  RETURN NEXT;

  -- Check user profile
  check_name := 'User profile check';
  status := EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = p_user_id
    AND role IN ('admin', 'merchant')
  );
  details := 'User has correct profile role';
  RETURN NEXT;

  -- Check collection access
  check_name := 'Collection access check';
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
GRANT ALL ON products TO authenticated;
GRANT ALL ON categories TO authenticated;
GRANT ALL ON orders TO authenticated;
GRANT ALL ON transaction_logs TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.has_merchant_access() TO authenticated;
GRANT EXECUTE ON FUNCTION verify_merchant_access(uuid) TO authenticated;