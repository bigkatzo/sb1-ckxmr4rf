-- Drop all existing policies
DO $$ BEGIN
  -- Drop collection policies
  DROP POLICY IF EXISTS "collections_policy" ON collections;
  DROP POLICY IF EXISTS "collections_access" ON collections;
  DROP POLICY IF EXISTS "collections_select" ON collections;
  DROP POLICY IF EXISTS "collections_insert" ON collections;
  DROP POLICY IF EXISTS "collections_update" ON collections;
  DROP POLICY IF EXISTS "collections_delete" ON collections;
  DROP POLICY IF EXISTS "collections_view" ON collections;
  DROP POLICY IF EXISTS "collections_edit" ON collections;
  DROP POLICY IF EXISTS "merchant_collections_view" ON collections;
  DROP POLICY IF EXISTS "merchant_collections_manage" ON collections;
  DROP POLICY IF EXISTS "merchant_collections_modify" ON collections;
  DROP POLICY IF EXISTS "merchant_collections_remove" ON collections;

  -- Drop category policies
  DROP POLICY IF EXISTS "categories_policy" ON categories;
  DROP POLICY IF EXISTS "categories_access" ON categories;
  DROP POLICY IF EXISTS "categories_select" ON categories;
  DROP POLICY IF EXISTS "categories_insert" ON categories;
  DROP POLICY IF EXISTS "categories_update" ON categories;
  DROP POLICY IF EXISTS "categories_delete" ON categories;
  DROP POLICY IF EXISTS "categories_view" ON categories;
  DROP POLICY IF EXISTS "categories_edit" ON categories;

  -- Drop product policies
  DROP POLICY IF EXISTS "products_policy" ON products;
  DROP POLICY IF EXISTS "products_access" ON products;
  DROP POLICY IF EXISTS "products_select" ON products;
  DROP POLICY IF EXISTS "products_insert" ON products;
  DROP POLICY IF EXISTS "products_update" ON products;
  DROP POLICY IF EXISTS "products_delete" ON products;
  DROP POLICY IF EXISTS "products_view" ON products;
  DROP POLICY IF EXISTS "products_edit" ON products;

  -- Drop order policies
  DROP POLICY IF EXISTS "orders_policy" ON orders;
  DROP POLICY IF EXISTS "orders_access" ON orders;
  DROP POLICY IF EXISTS "orders_select" ON orders;
  DROP POLICY IF EXISTS "orders_insert" ON orders;
  DROP POLICY IF EXISTS "orders_update" ON orders;
  DROP POLICY IF EXISTS "orders_delete" ON orders;
  DROP POLICY IF EXISTS "orders_view" ON orders;
  DROP POLICY IF EXISTS "orders_edit" ON orders;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create RLS policies for collections
CREATE POLICY "collections_view"
  ON collections
  FOR SELECT
  TO authenticated
  USING (
    -- Admin can view all collections
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
    OR
    -- User owns the collection
    user_id = auth.uid()
    OR 
    -- User has any type of access to the collection
    EXISTS (
      SELECT 1 FROM collection_access ca
      WHERE ca.collection_id = collections.id
      AND ca.user_id = auth.uid()
      AND ca.access_type IN ('view', 'edit')
    )
  );

CREATE POLICY "collections_insert"
  ON collections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admin can insert collections
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
    OR
    -- User owns the collection
    user_id = auth.uid()
  );

CREATE POLICY "collections_update"
  ON collections
  FOR UPDATE
  TO authenticated
  USING (
    -- Admin can edit all collections
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
    OR
    -- User owns the collection or has edit access
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM collection_access ca
      WHERE ca.collection_id = collections.id
      AND ca.user_id = auth.uid()
      AND ca.access_type = 'edit'
    )
  );

CREATE POLICY "collections_delete"
  ON collections
  FOR DELETE
  TO authenticated
  USING (
    -- Admin can delete all collections
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
    OR
    -- Only owner can delete
    user_id = auth.uid()
  );

-- Create RLS policies for categories
CREATE POLICY "categories_view"
  ON categories
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      LEFT JOIN collection_access ca ON ca.collection_id = c.id AND ca.user_id = auth.uid()
      WHERE c.id = categories.collection_id
      AND (
        -- Admin can view all categories
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE id = auth.uid()
          AND role = 'admin'
        )
        OR
        -- User owns the collection
        c.user_id = auth.uid()
        OR 
        -- User has any type of access to the collection
        ca.access_type IN ('view', 'edit')
      )
    )
  );

CREATE POLICY "categories_insert"
  ON categories
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections c
      LEFT JOIN collection_access ca ON ca.collection_id = c.id AND ca.user_id = auth.uid()
      WHERE c.id = categories.collection_id
      AND (
        -- Admin can insert categories
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE id = auth.uid()
          AND role = 'admin'
        )
        OR
        -- User owns the collection
        c.user_id = auth.uid()
        OR 
        -- User has edit access to the collection
        ca.access_type = 'edit'
      )
    )
  );

CREATE POLICY "categories_update"
  ON categories
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      LEFT JOIN collection_access ca ON ca.collection_id = c.id AND ca.user_id = auth.uid()
      WHERE c.id = categories.collection_id
      AND (
        -- Admin can update categories
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE id = auth.uid()
          AND role = 'admin'
        )
        OR
        -- User owns the collection
        c.user_id = auth.uid()
        OR 
        -- User has edit access to the collection
        ca.access_type = 'edit'
      )
    )
  );

CREATE POLICY "categories_delete"
  ON categories
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      LEFT JOIN collection_access ca ON ca.collection_id = c.id AND ca.user_id = auth.uid()
      WHERE c.id = categories.collection_id
      AND (
        -- Admin can delete categories
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE id = auth.uid()
          AND role = 'admin'
        )
        OR
        -- User owns the collection
        c.user_id = auth.uid()
        OR 
        -- User has edit access to the collection
        ca.access_type = 'edit'
      )
    )
  );

-- Create RLS policies for products
CREATE POLICY "products_view"
  ON products
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      LEFT JOIN collection_access ca ON ca.collection_id = c.id AND ca.user_id = auth.uid()
      WHERE c.id = products.collection_id
      AND (
        -- Admin can view all products
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE id = auth.uid()
          AND role = 'admin'
        )
        OR
        -- User owns the collection
        c.user_id = auth.uid()
        OR 
        -- User has any type of access to the collection
        ca.access_type IN ('view', 'edit')
      )
    )
  );

CREATE POLICY "products_insert"
  ON products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections c
      LEFT JOIN collection_access ca ON ca.collection_id = c.id AND ca.user_id = auth.uid()
      WHERE c.id = products.collection_id
      AND (
        -- Admin can insert products
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE id = auth.uid()
          AND role = 'admin'
        )
        OR
        -- User owns the collection
        c.user_id = auth.uid()
        OR 
        -- User has edit access to the collection
        ca.access_type = 'edit'
      )
    )
  );

CREATE POLICY "products_update"
  ON products
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      LEFT JOIN collection_access ca ON ca.collection_id = c.id AND ca.user_id = auth.uid()
      WHERE c.id = products.collection_id
      AND (
        -- Admin can update products
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE id = auth.uid()
          AND role = 'admin'
        )
        OR
        -- User owns the collection
        c.user_id = auth.uid()
        OR 
        -- User has edit access to the collection
        ca.access_type = 'edit'
      )
    )
  );

CREATE POLICY "products_delete"
  ON products
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      LEFT JOIN collection_access ca ON ca.collection_id = c.id AND ca.user_id = auth.uid()
      WHERE c.id = products.collection_id
      AND (
        -- Admin can delete products
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE id = auth.uid()
          AND role = 'admin'
        )
        OR
        -- User owns the collection
        c.user_id = auth.uid()
        OR 
        -- User has edit access to the collection
        ca.access_type = 'edit'
      )
    )
  );

-- Create RLS policies for orders
CREATE POLICY "orders_view"
  ON orders
  FOR SELECT
  TO authenticated
  USING (
    -- Admin can view all orders
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM products p
      JOIN collections c ON c.id = p.collection_id
      LEFT JOIN collection_access ca ON ca.collection_id = c.id AND ca.user_id = auth.uid()
      WHERE p.id = orders.product_id
      AND (
        -- User owns the collection
        c.user_id = auth.uid()
        OR 
        -- User has any type of access to the collection
        ca.access_type IN ('view', 'edit')
      )
    )
  );

CREATE POLICY "orders_insert"
  ON orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admin can insert orders
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM products p
      JOIN collections c ON c.id = p.collection_id
      LEFT JOIN collection_access ca ON ca.collection_id = c.id AND ca.user_id = auth.uid()
      WHERE p.id = orders.product_id
      AND (
        -- User owns the collection
        c.user_id = auth.uid()
        OR 
        -- User has edit access to the collection
        ca.access_type = 'edit'
      )
    )
  );

CREATE POLICY "orders_update"
  ON orders
  FOR UPDATE
  TO authenticated
  USING (
    -- Admin can update orders
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM products p
      JOIN collections c ON c.id = p.collection_id
      LEFT JOIN collection_access ca ON ca.collection_id = c.id AND ca.user_id = auth.uid()
      WHERE p.id = orders.product_id
      AND (
        -- User owns the collection
        c.user_id = auth.uid()
        OR 
        -- User has edit access to the collection
        ca.access_type = 'edit'
      )
    )
  );

CREATE POLICY "orders_delete"
  ON orders
  FOR DELETE
  TO authenticated
  USING (
    -- Admin can delete orders
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM products p
      JOIN collections c ON c.id = p.collection_id
      LEFT JOIN collection_access ca ON ca.collection_id = c.id AND ca.user_id = auth.uid()
      WHERE p.id = orders.product_id
      AND (
        -- User owns the collection
        c.user_id = auth.uid()
        OR 
        -- User has edit access to the collection
        ca.access_type = 'edit'
      )
    )
  ); 