-- Drop existing policies first
DO $$ BEGIN
  DROP POLICY IF EXISTS "products_select" ON products;
  DROP POLICY IF EXISTS "products_modify" ON products;
  DROP POLICY IF EXISTS "categories_select" ON categories;
  DROP POLICY IF EXISTS "categories_modify" ON categories;
  DROP POLICY IF EXISTS "orders_select" ON orders;
  DROP POLICY IF EXISTS "orders_modify" ON orders;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Enable RLS on all tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Create single policy for products
CREATE POLICY "products_access"
  ON products
  FOR ALL
  TO authenticated
  USING (
    -- Anyone can view products in visible collections
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
  )
  WITH CHECK (
    -- Only collection owners can modify
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND c.user_id = auth.uid()
    )
  );

-- Create single policy for categories
CREATE POLICY "categories_access"
  ON categories
  FOR ALL
  TO authenticated
  USING (
    -- Anyone can view categories in visible collections
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
  )
  WITH CHECK (
    -- Only collection owners can modify
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND c.user_id = auth.uid()
    )
  );

-- Create single policy for orders
CREATE POLICY "orders_access"
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
  )
  WITH CHECK (
    -- Only collection owners can modify orders for their products
    EXISTS (
      SELECT 1 FROM products p
      JOIN collections c ON c.id = p.collection_id
      WHERE p.id = orders.product_id
      AND c.user_id = auth.uid()
    )
  );

-- Grant necessary permissions
GRANT ALL ON products TO authenticated;
GRANT ALL ON categories TO authenticated;
GRANT ALL ON orders TO authenticated;

-- Create helper function to check collection ownership
CREATE OR REPLACE FUNCTION auth.owns_collection(collection_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM collections
    WHERE id = collection_id
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create helper function to check product ownership
CREATE OR REPLACE FUNCTION auth.owns_product(product_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM products p
    JOIN collections c ON c.id = p.collection_id
    WHERE p.id = product_id
    AND c.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create helper function to check category ownership
CREATE OR REPLACE FUNCTION auth.owns_category(category_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM categories cat
    JOIN collections c ON c.id = cat.collection_id
    WHERE cat.id = category_id
    AND c.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION auth.owns_collection(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION auth.owns_product(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION auth.owns_category(uuid) TO authenticated;