-- Add admin bypass to all relevant RLS policies
DO $$ 
BEGIN
  -- Drop existing policies
  DROP POLICY IF EXISTS "orders_select_merchant" ON orders;
  DROP POLICY IF EXISTS "orders_update_merchant" ON orders;
  DROP POLICY IF EXISTS "collections_select_policy" ON collections;
  DROP POLICY IF EXISTS "collections_update_policy" ON collections;
  DROP POLICY IF EXISTS "products_select_policy" ON products;
  DROP POLICY IF EXISTS "products_update_policy" ON products;
  DROP POLICY IF EXISTS "categories_select_policy" ON categories;
  DROP POLICY IF EXISTS "categories_update_policy" ON categories;

  -- Recreate policies with admin bypass
  -- Orders
  CREATE POLICY "orders_select_merchant"
    ON orders FOR SELECT
    TO authenticated
    USING (
      (SELECT is_admin FROM auth.is_admin()) OR
      EXISTS (
        SELECT 1 FROM products p
        JOIN collections c ON c.id = p.collection_id
        WHERE p.id = orders.product_id
        AND c.user_id = auth.uid()
      )
    );

  CREATE POLICY "orders_update_merchant"
    ON orders FOR UPDATE
    TO authenticated
    USING (
      (SELECT is_admin FROM auth.is_admin()) OR
      EXISTS (
        SELECT 1 FROM products p
        JOIN collections c ON c.id = p.collection_id
        WHERE p.id = orders.product_id
        AND c.user_id = auth.uid()
      )
    );

  -- Collections
  CREATE POLICY "collections_select_policy"
    ON collections FOR SELECT
    TO authenticated
    USING (
      (SELECT is_admin FROM auth.is_admin()) OR
      user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM collection_access
        WHERE collection_id = collections.id
        AND user_id = auth.uid()
      )
    );

  CREATE POLICY "collections_update_policy"
    ON collections FOR UPDATE
    TO authenticated
    USING (
      (SELECT is_admin FROM auth.is_admin()) OR
      user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM collection_access
        WHERE collection_id = collections.id
        AND user_id = auth.uid()
        AND access_type = 'edit'
      )
    );

  -- Products
  CREATE POLICY "products_select_policy"
    ON products FOR SELECT
    TO authenticated
    USING (
      (SELECT is_admin FROM auth.is_admin()) OR
      EXISTS (
        SELECT 1 FROM collections
        WHERE collections.id = products.collection_id
        AND (
          collections.user_id = auth.uid() OR
          EXISTS (
            SELECT 1 FROM collection_access
            WHERE collection_id = collections.id
            AND user_id = auth.uid()
          )
        )
      )
    );

  CREATE POLICY "products_update_policy"
    ON products FOR UPDATE
    TO authenticated
    USING (
      (SELECT is_admin FROM auth.is_admin()) OR
      EXISTS (
        SELECT 1 FROM collections
        WHERE collections.id = products.collection_id
        AND (
          collections.user_id = auth.uid() OR
          EXISTS (
            SELECT 1 FROM collection_access
            WHERE collection_id = collections.id
            AND user_id = auth.uid()
            AND access_type = 'edit'
          )
        )
      )
    );

  -- Categories
  CREATE POLICY "categories_select_policy"
    ON categories FOR SELECT
    TO authenticated
    USING (
      (SELECT is_admin FROM auth.is_admin()) OR
      EXISTS (
        SELECT 1 FROM collections
        WHERE collections.id = categories.collection_id
        AND (
          collections.user_id = auth.uid() OR
          EXISTS (
            SELECT 1 FROM collection_access
            WHERE collection_id = collections.id
            AND user_id = auth.uid()
          )
        )
      )
    );

  CREATE POLICY "categories_update_policy"
    ON categories FOR UPDATE
    TO authenticated
    USING (
      (SELECT is_admin FROM auth.is_admin()) OR
      EXISTS (
        SELECT 1 FROM collections
        WHERE collections.id = categories.collection_id
        AND (
          collections.user_id = auth.uid() OR
          EXISTS (
            SELECT 1 FROM collection_access
            WHERE collection_id = collections.id
            AND user_id = auth.uid()
            AND access_type = 'edit'
          )
        )
      )
    );

END $$; 