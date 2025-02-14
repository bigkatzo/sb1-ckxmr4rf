-- Drop existing policies and functions
DO $$ BEGIN
  DROP POLICY IF EXISTS "public_collections_select" ON collections;
  DROP POLICY IF EXISTS "public_products_select" ON products;
  DROP POLICY IF EXISTS "public_categories_select" ON categories;
  DROP POLICY IF EXISTS "authenticated_collections_all" ON collections;
  DROP POLICY IF EXISTS "authenticated_products_all" ON products;
  DROP POLICY IF EXISTS "authenticated_categories_all" ON categories;
  DROP FUNCTION IF EXISTS auth.is_admin() CASCADE;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create simplified admin check function
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN current_setting('request.jwt.claims', true)::jsonb->>'email' = 'admin420@merchant.local';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create public access policies
CREATE POLICY "anon_select_collections"
  ON collections FOR SELECT
  TO anon, authenticated
  USING (visible = true);

CREATE POLICY "anon_select_products"
  ON products FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND c.visible = true
    )
  );

CREATE POLICY "anon_select_categories"
  ON categories FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND c.visible = true
    )
  );

-- Create merchant access policies
CREATE POLICY "merchant_all_collections"
  ON collections FOR ALL
  TO authenticated
  USING (user_id = auth.uid() OR auth.is_admin())
  WITH CHECK (user_id = auth.uid() OR auth.is_admin());

CREATE POLICY "merchant_all_products"
  ON products FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND (c.user_id = auth.uid() OR auth.is_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND (c.user_id = auth.uid() OR auth.is_admin())
    )
  );

CREATE POLICY "merchant_all_categories"
  ON categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND (c.user_id = auth.uid() OR auth.is_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND (c.user_id = auth.uid() OR auth.is_admin())
    )
  );

-- Grant basic permissions
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant read-only permissions to anon
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Grant full permissions to authenticated users
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Ensure RLS is enabled
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;