-- Drop existing policies first
DO $$ BEGIN
  DROP POLICY IF EXISTS "products_policy" ON products;
  DROP POLICY IF EXISTS "categories_policy" ON categories;
  DROP POLICY IF EXISTS "orders_policy" ON orders;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

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

-- Create helper function to check collection access
CREATE OR REPLACE FUNCTION auth.has_collection_access(collection_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN 
    -- Admin has access to everything
    auth.is_admin()
    OR
    -- Collection owners have access
    EXISTS (
      SELECT 1 FROM collections
      WHERE id = collection_id
      AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION auth.has_collection_access(uuid) TO authenticated;