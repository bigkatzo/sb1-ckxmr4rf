-- Drop existing policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "Collections public read" ON collections;
  DROP POLICY IF EXISTS "Collections merchant access" ON collections;
  DROP POLICY IF EXISTS "Products public read" ON products;
  DROP POLICY IF EXISTS "Products merchant access" ON products;
  DROP POLICY IF EXISTS "Categories public read" ON categories;
  DROP POLICY IF EXISTS "Categories merchant access" ON categories;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Collections policies
CREATE POLICY "Public read collections"
  ON collections FOR SELECT
  TO public
  USING (visible = true OR auth.uid() = user_id);

CREATE POLICY "Merchant manage collections"
  ON collections FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Products policies
CREATE POLICY "Public read products"
  ON products FOR SELECT
  TO public
  USING (EXISTS (
    SELECT 1 FROM collections
    WHERE collections.id = products.collection_id
    AND (collections.visible = true OR collections.user_id = auth.uid())
  ));

CREATE POLICY "Merchant manage products"
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
CREATE POLICY "Public read categories"
  ON categories FOR SELECT
  TO public
  USING (EXISTS (
    SELECT 1 FROM collections
    WHERE collections.id = categories.collection_id
    AND (collections.visible = true OR collections.user_id = auth.uid())
  ));

CREATE POLICY "Merchant manage categories"
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

-- Create helper functions for checking permissions
CREATE OR REPLACE FUNCTION check_merchant_collection_access(collection_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM collections
    WHERE collections.id = check_merchant_collection_access.collection_id
    AND collections.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION check_merchant_product_access(product_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM products
    JOIN collections ON collections.id = products.collection_id
    WHERE products.id = check_merchant_product_access.product_id
    AND collections.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;