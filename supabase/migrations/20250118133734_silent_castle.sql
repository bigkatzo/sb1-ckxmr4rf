-- Drop existing policies first
DO $$ BEGIN
  DROP POLICY IF EXISTS "products_policy" ON products;
  DROP POLICY IF EXISTS "categories_policy" ON categories;
  DROP POLICY IF EXISTS "orders_policy" ON orders;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Enable RLS on all tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Create super simple RLS policies for products
CREATE POLICY "products_select"
  ON products FOR SELECT
  TO authenticated
  USING (
    -- Admin can see everything
    (SELECT email = 'admin420@merchant.local' FROM auth.users WHERE id = auth.uid())
    OR
    -- Merchants can see their own
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "products_insert"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admin can modify everything
    (SELECT email = 'admin420@merchant.local' FROM auth.users WHERE id = auth.uid())
    OR
    -- Merchants can modify their own
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "products_update"
  ON products FOR UPDATE
  TO authenticated
  USING (
    -- Admin can modify everything
    (SELECT email = 'admin420@merchant.local' FROM auth.users WHERE id = auth.uid())
    OR
    -- Merchants can modify their own
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "products_delete"
  ON products FOR DELETE
  TO authenticated
  USING (
    -- Admin can modify everything
    (SELECT email = 'admin420@merchant.local' FROM auth.users WHERE id = auth.uid())
    OR
    -- Merchants can modify their own
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND c.user_id = auth.uid()
    )
  );

-- Create super simple RLS policies for categories
CREATE POLICY "categories_select"
  ON categories FOR SELECT
  TO authenticated
  USING (
    -- Admin can see everything
    (SELECT email = 'admin420@merchant.local' FROM auth.users WHERE id = auth.uid())
    OR
    -- Merchants can see their own
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "categories_insert"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admin can modify everything
    (SELECT email = 'admin420@merchant.local' FROM auth.users WHERE id = auth.uid())
    OR
    -- Merchants can modify their own
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "categories_update"
  ON categories FOR UPDATE
  TO authenticated
  USING (
    -- Admin can modify everything
    (SELECT email = 'admin420@merchant.local' FROM auth.users WHERE id = auth.uid())
    OR
    -- Merchants can modify their own
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "categories_delete"
  ON categories FOR DELETE
  TO authenticated
  USING (
    -- Admin can modify everything
    (SELECT email = 'admin420@merchant.local' FROM auth.users WHERE id = auth.uid())
    OR
    -- Merchants can modify their own
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND c.user_id = auth.uid()
    )
  );

-- Create super simple RLS policies for orders
CREATE POLICY "orders_select"
  ON orders FOR SELECT
  TO authenticated
  USING (
    -- Admin can see everything
    (SELECT email = 'admin420@merchant.local' FROM auth.users WHERE id = auth.uid())
    OR
    -- Merchants can see orders for their products
    EXISTS (
      SELECT 1 FROM products p
      JOIN collections c ON c.id = p.collection_id
      WHERE p.id = orders.product_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "orders_insert"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admin can modify everything
    (SELECT email = 'admin420@merchant.local' FROM auth.users WHERE id = auth.uid())
    OR
    -- Merchants can modify orders for their products
    EXISTS (
      SELECT 1 FROM products p
      JOIN collections c ON c.id = p.collection_id
      WHERE p.id = orders.product_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "orders_update"
  ON orders FOR UPDATE
  TO authenticated
  USING (
    -- Admin can modify everything
    (SELECT email = 'admin420@merchant.local' FROM auth.users WHERE id = auth.uid())
    OR
    -- Merchants can modify orders for their products
    EXISTS (
      SELECT 1 FROM products p
      JOIN collections c ON c.id = p.collection_id
      WHERE p.id = orders.product_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "orders_delete"
  ON orders FOR DELETE
  TO authenticated
  USING (
    -- Admin can modify everything
    (SELECT email = 'admin420@merchant.local' FROM auth.users WHERE id = auth.uid())
    OR
    -- Merchants can modify orders for their products
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

-- Ensure admin420 has correct role and metadata
UPDATE auth.users
SET 
  role = 'authenticated',
  raw_app_meta_data = jsonb_build_object(
    'provider', 'username',
    'providers', array['username'],
    'username', 'admin420'
  ),
  raw_user_meta_data = jsonb_build_object(
    'username', 'admin420'
  )
WHERE email = 'admin420@merchant.local';

-- Ensure admin420 has admin profile
INSERT INTO user_profiles (id, role)
SELECT id, 'admin'
FROM auth.users 
WHERE email = 'admin420@merchant.local'
ON CONFLICT (id) DO UPDATE 
SET role = 'admin';