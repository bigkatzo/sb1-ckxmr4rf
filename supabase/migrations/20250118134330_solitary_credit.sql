-- Drop existing policies first
DO $$ BEGIN
  DROP POLICY IF EXISTS "products_select" ON products;
  DROP POLICY IF EXISTS "products_insert" ON products;
  DROP POLICY IF EXISTS "products_update" ON products;
  DROP POLICY IF EXISTS "products_delete" ON products;
  DROP POLICY IF EXISTS "categories_select" ON categories;
  DROP POLICY IF EXISTS "categories_insert" ON categories;
  DROP POLICY IF EXISTS "categories_update" ON categories;
  DROP POLICY IF EXISTS "categories_delete" ON categories;
  DROP POLICY IF EXISTS "orders_select" ON orders;
  DROP POLICY IF EXISTS "orders_insert" ON orders;
  DROP POLICY IF EXISTS "orders_update" ON orders;
  DROP POLICY IF EXISTS "orders_delete" ON orders;
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
    auth.is_admin()
    OR auth.owns_collection(collection_id)
  );

CREATE POLICY "products_insert"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.is_admin()
    OR auth.owns_collection(collection_id)
  );

CREATE POLICY "products_update"
  ON products FOR UPDATE
  TO authenticated
  USING (
    auth.is_admin()
    OR auth.owns_collection(collection_id)
  );

CREATE POLICY "products_delete"
  ON products FOR DELETE
  TO authenticated
  USING (
    auth.is_admin()
    OR auth.owns_collection(collection_id)
  );

-- Create super simple RLS policies for categories
CREATE POLICY "categories_select"
  ON categories FOR SELECT
  TO authenticated
  USING (
    auth.is_admin()
    OR auth.owns_collection(collection_id)
  );

CREATE POLICY "categories_insert"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.is_admin()
    OR auth.owns_collection(collection_id)
  );

CREATE POLICY "categories_update"
  ON categories FOR UPDATE
  TO authenticated
  USING (
    auth.is_admin()
    OR auth.owns_collection(collection_id)
  );

CREATE POLICY "categories_delete"
  ON categories FOR DELETE
  TO authenticated
  USING (
    auth.is_admin()
    OR auth.owns_collection(collection_id)
  );

-- Create super simple RLS policies for orders
CREATE POLICY "orders_select"
  ON orders FOR SELECT
  TO authenticated
  USING (
    auth.is_admin()
    OR EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = orders.product_id
      AND auth.owns_collection(p.collection_id)
    )
  );

CREATE POLICY "orders_insert"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.is_admin()
    OR EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = orders.product_id
      AND auth.owns_collection(p.collection_id)
    )
  );

CREATE POLICY "orders_update"
  ON orders FOR UPDATE
  TO authenticated
  USING (
    auth.is_admin()
    OR EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = orders.product_id
      AND auth.owns_collection(p.collection_id)
    )
  );

CREATE POLICY "orders_delete"
  ON orders FOR DELETE
  TO authenticated
  USING (
    auth.is_admin()
    OR EXISTS (
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