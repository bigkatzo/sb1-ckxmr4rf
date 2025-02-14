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

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN current_setting('request.jwt.claims', true)::jsonb->>'email' = 'admin420@merchant.local';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user is merchant
CREATE OR REPLACE FUNCTION auth.is_merchant()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'merchant')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user owns collection
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

-- Create super simple RLS policies for products
CREATE POLICY "products_select"
  ON products FOR SELECT
  TO authenticated
  USING (
    -- Admin can see everything
    auth.is_admin()
    OR
    -- Merchants can see their own
    auth.owns_collection(collection_id)
  );

CREATE POLICY "products_modify"
  ON products FOR ALL
  TO authenticated
  USING (
    -- Admin can modify everything
    auth.is_admin()
    OR
    -- Merchants can modify their own
    auth.owns_collection(collection_id)
  )
  WITH CHECK (
    -- Admin can modify everything
    auth.is_admin()
    OR
    -- Merchants can modify their own
    auth.owns_collection(collection_id)
  );

-- Create super simple RLS policies for categories
CREATE POLICY "categories_select"
  ON categories FOR SELECT
  TO authenticated
  USING (
    -- Admin can see everything
    auth.is_admin()
    OR
    -- Merchants can see their own
    auth.owns_collection(collection_id)
  );

CREATE POLICY "categories_modify"
  ON categories FOR ALL
  TO authenticated
  USING (
    -- Admin can modify everything
    auth.is_admin()
    OR
    -- Merchants can modify their own
    auth.owns_collection(collection_id)
  )
  WITH CHECK (
    -- Admin can modify everything
    auth.is_admin()
    OR
    -- Merchants can modify their own
    auth.owns_collection(collection_id)
  );

-- Create super simple RLS policies for orders
CREATE POLICY "orders_select"
  ON orders FOR SELECT
  TO authenticated
  USING (
    -- Admin can see everything
    auth.is_admin()
    OR
    -- Merchants can see orders for their products
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = orders.product_id
      AND auth.owns_collection(p.collection_id)
    )
  );

CREATE POLICY "orders_modify"
  ON orders FOR ALL
  TO authenticated
  USING (
    -- Admin can modify everything
    auth.is_admin()
    OR
    -- Merchants can modify orders for their products
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = orders.product_id
      AND auth.owns_collection(p.collection_id)
    )
  )
  WITH CHECK (
    -- Admin can modify everything
    auth.is_admin()
    OR
    -- Merchants can modify orders for their products
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = orders.product_id
      AND auth.owns_collection(p.collection_id)
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