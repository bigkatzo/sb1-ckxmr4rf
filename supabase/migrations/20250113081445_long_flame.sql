-- Drop existing policies if they exist
DO $$ BEGIN
  -- Collections policies
  DROP POLICY IF EXISTS "Anyone can view visible collections" ON collections;
  DROP POLICY IF EXISTS "Authenticated users can manage their collections" ON collections;
  DROP POLICY IF EXISTS "Public can view visible collections" ON collections;
  DROP POLICY IF EXISTS "Users can manage their collections" ON collections;

  -- Products policies
  DROP POLICY IF EXISTS "Public can view products in visible collections" ON products;
  DROP POLICY IF EXISTS "Users can manage their products" ON products;
  DROP POLICY IF EXISTS "Public can view products" ON products;
  DROP POLICY IF EXISTS "Authenticated users can manage their products" ON products;

  -- Categories policies
  DROP POLICY IF EXISTS "Public can view categories" ON categories;
  DROP POLICY IF EXISTS "Users can manage their categories" ON categories;
  DROP POLICY IF EXISTS "Authenticated users can manage their categories" ON categories;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Collections policies
CREATE POLICY "Collections public read"
  ON collections FOR SELECT
  TO public
  USING (visible = true);

CREATE POLICY "Collections merchant access"
  ON collections FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Products policies
CREATE POLICY "Products public read"
  ON products FOR SELECT
  TO public
  USING (EXISTS (
    SELECT 1 FROM collections
    WHERE collections.id = products.collection_id
    AND collections.visible = true
  ));

CREATE POLICY "Products merchant access"
  ON products FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM collections
    WHERE collections.id = products.collection_id
    AND collections.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM collections
    WHERE collections.id = products.collection_id
    AND collections.user_id = auth.uid()
  ));

-- Categories policies
CREATE POLICY "Categories public read"
  ON categories FOR SELECT
  TO public
  USING (EXISTS (
    SELECT 1 FROM collections
    WHERE collections.id = categories.collection_id
    AND collections.visible = true
  ));

CREATE POLICY "Categories merchant access"
  ON categories FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM collections
    WHERE collections.id = categories.collection_id
    AND collections.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM collections
    WHERE collections.id = categories.collection_id
    AND collections.user_id = auth.uid()
  ));