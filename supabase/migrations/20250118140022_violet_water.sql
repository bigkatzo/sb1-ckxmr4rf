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

-- Create maximally permissive RLS policies for products
CREATE POLICY "products_select"
  ON products FOR SELECT
  TO public
  USING (true);

CREATE POLICY "products_modify"
  ON products FOR ALL
  TO authenticated
  USING (true)
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

-- Create maximally permissive RLS policies for categories  
CREATE POLICY "categories_select"
  ON categories FOR SELECT
  TO public
  USING (true);

CREATE POLICY "categories_modify"
  ON categories FOR ALL
  TO authenticated
  USING (true)
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

-- Create maximally permissive RLS policies for orders
CREATE POLICY "orders_select"
  ON orders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "orders_modify"
  ON orders FOR ALL
  TO authenticated
  USING (true)
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