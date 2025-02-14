-- Drop existing policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "anon_select_collections" ON collections;
  DROP POLICY IF EXISTS "anon_select_products" ON products;
  DROP POLICY IF EXISTS "anon_select_categories" ON categories;
  DROP POLICY IF EXISTS "merchant_all_collections" ON collections;
  DROP POLICY IF EXISTS "merchant_all_products" ON products;
  DROP POLICY IF EXISTS "merchant_all_categories" ON categories;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create maximally permissive select policies for public access
CREATE POLICY "public_select_collections"
  ON collections FOR SELECT
  USING (true);

CREATE POLICY "public_select_products"
  ON products FOR SELECT
  USING (true);

CREATE POLICY "public_select_categories"
  ON categories FOR SELECT
  USING (true);

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