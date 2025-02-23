-- Drop existing policies
DROP POLICY IF EXISTS "collections_policy" ON collections;
DROP POLICY IF EXISTS "products_policy" ON products;
DROP POLICY IF EXISTS "categories_policy" ON categories;

-- Public Storefront Policies
-- These policies allow anyone to view public content based on visibility flag

-- Collections: Public can view visible collections
CREATE POLICY "public_view_collections"
  ON collections
  FOR SELECT
  USING (visible = true);

-- Products: Public can view products in visible collections
CREATE POLICY "public_view_products"
  ON products
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND c.visible = true
    )
  );

-- Categories: Public can view categories in visible collections
CREATE POLICY "public_view_categories"
  ON categories
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND c.visible = true
    )
  );

-- Merchant Dashboard Policies
-- These policies allow authenticated merchants to manage their content

-- Collections: Merchants can manage their collections
CREATE POLICY "merchant_manage_collections"
  ON collections
  FOR ALL
  TO authenticated
  USING (
    -- Can view all collections they own or have access to
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM collection_access ca
      WHERE ca.collection_id = collections.id
      AND ca.user_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Can only modify collections they own
    auth.uid() = user_id
  );

-- Products: Merchants can manage their products
CREATE POLICY "merchant_manage_products"
  ON products
  FOR ALL
  TO authenticated
  USING (
    -- Can view/modify products in collections they own or have access to
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND (
        c.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM collection_access ca
          WHERE ca.collection_id = c.id
          AND ca.user_id = auth.uid()
        )
      )
    )
  );

-- Categories: Merchants can manage their categories
CREATE POLICY "merchant_manage_categories"
  ON categories
  FOR ALL
  TO authenticated
  USING (
    -- Can view/modify categories in collections they own or have access to
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND (
        c.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM collection_access ca
          WHERE ca.collection_id = c.id
          AND ca.user_id = auth.uid()
        )
      )
    )
  );

-- Create helper function to check if user has access to collection
CREATE OR REPLACE FUNCTION auth.has_collection_access(collection_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM collections c
    WHERE c.id = collection_id
    AND (
      c.user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM collection_access ca
        WHERE ca.collection_id = c.id
        AND ca.user_id = auth.uid()
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION auth.has_collection_access IS 'Checks if the current user has access to a collection'; 