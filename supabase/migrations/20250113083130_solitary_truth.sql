-- Drop existing policies to start fresh
DO $$ BEGIN
  DROP POLICY IF EXISTS "Public read collections" ON collections;
  DROP POLICY IF EXISTS "Merchant manage collections" ON collections;
  DROP POLICY IF EXISTS "Public read products" ON products;
  DROP POLICY IF EXISTS "Merchant manage products" ON products;
  DROP POLICY IF EXISTS "Public read categories" ON categories;
  DROP POLICY IF EXISTS "Merchant manage categories" ON categories;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Collections policies
CREATE POLICY "Public read collections"
  ON collections FOR SELECT
  TO public
  USING (visible = true OR auth.uid() = user_id);

CREATE POLICY "Merchant insert collections"
  ON collections FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Merchant update collections"
  ON collections FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Merchant delete collections"
  ON collections FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Products policies
CREATE POLICY "Public read products"
  ON products FOR SELECT
  TO public
  USING (EXISTS (
    SELECT 1 FROM collections
    WHERE collections.id = products.collection_id
    AND (collections.visible = true OR collections.user_id = auth.uid())
  ));

CREATE POLICY "Merchant insert products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM collections
    WHERE collections.id = products.collection_id
    AND collections.user_id = auth.uid()
  ));

CREATE POLICY "Merchant update products"
  ON products FOR UPDATE
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

CREATE POLICY "Merchant delete products"
  ON products FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM collections
    WHERE collections.id = products.collection_id
    AND collections.user_id = auth.uid()
  ));

-- Categories policies
CREATE POLICY "Public read categories"
  ON categories FOR SELECT
  TO public
  USING (EXISTS (
    SELECT 1 FROM collections
    WHERE collections.id = categories.collection_id
    AND (collections.visible = true OR collections.user_id = auth.uid())
  ));

CREATE POLICY "Merchant insert categories"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM collections
    WHERE collections.id = categories.collection_id
    AND collections.user_id = auth.uid()
  ));

CREATE POLICY "Merchant update categories"
  ON categories FOR UPDATE
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

CREATE POLICY "Merchant delete categories"
  ON categories FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM collections
    WHERE collections.id = categories.collection_id
    AND collections.user_id = auth.uid()
  ));

-- Storage policies
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Insert Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete Access" ON storage.objects;

CREATE POLICY "Storage public read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "Storage authenticated insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "Storage authenticated update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "Storage authenticated delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id IN ('collection-images', 'product-images'));