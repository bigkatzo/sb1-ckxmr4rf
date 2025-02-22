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

-- Enable RLS on all tables
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for collections
CREATE POLICY "collections_select"
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
    -- User has access through collection_access
    EXISTS (
      SELECT 1 FROM collection_access
      WHERE collection_id = id
      AND user_id = auth.uid()
      AND access_type IN ('view', 'edit')
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
    -- User is the owner
    user_id = auth.uid()
  );

CREATE POLICY "collections_update"
  ON collections
  FOR UPDATE
  TO authenticated
  USING (
    -- Admin can update all collections
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
    OR
    -- User owns the collection
    user_id = auth.uid()
    OR
    -- User has edit access
    EXISTS (
      SELECT 1 FROM collection_access
      WHERE collection_id = id
      AND user_id = auth.uid()
      AND access_type = 'edit'
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
    -- Only owner can delete their collections
    user_id = auth.uid()
  );

-- Create RLS policies for categories
CREATE POLICY "categories_select"
  ON categories
  FOR SELECT
  TO authenticated
  USING (
    -- Admin can view all categories
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
    OR
    -- User has access to the parent collection
    EXISTS (
      SELECT 1 FROM collections
      WHERE id = collection_id
      AND (
        user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM collection_access
          WHERE collection_id = collections.id
          AND user_id = auth.uid()
          AND access_type IN ('view', 'edit')
        )
      )
    )
  );

CREATE POLICY "categories_insert"
  ON categories
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admin can insert categories
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
    OR
    -- User has edit access to the parent collection
    EXISTS (
      SELECT 1 FROM collections
      WHERE id = collection_id
      AND (
        user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM collection_access
          WHERE collection_id = collections.id
          AND user_id = auth.uid()
          AND access_type = 'edit'
        )
      )
    )
  );

CREATE POLICY "categories_update"
  ON categories
  FOR UPDATE
  TO authenticated
  USING (
    -- Admin can update categories
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
    OR
    -- User has edit access to the parent collection
    EXISTS (
      SELECT 1 FROM collections
      WHERE id = collection_id
      AND (
        user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM collection_access
          WHERE collection_id = collections.id
          AND user_id = auth.uid()
          AND access_type = 'edit'
        )
      )
    )
  );

CREATE POLICY "categories_delete"
  ON categories
  FOR DELETE
  TO authenticated
  USING (
    -- Admin can delete categories
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
    OR
    -- User has edit access to the parent collection
    EXISTS (
      SELECT 1 FROM collections
      WHERE id = collection_id
      AND (
        user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM collection_access
          WHERE collection_id = collections.id
          AND user_id = auth.uid()
          AND access_type = 'edit'
        )
      )
    )
  );

-- Create RLS policies for products
CREATE POLICY "products_select"
  ON products
  FOR SELECT
  TO authenticated
  USING (
    -- Admin can view all products
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
    OR
    -- User has access to the parent collection
    EXISTS (
      SELECT 1 FROM collections
      WHERE id = collection_id
      AND (
        user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM collection_access
          WHERE collection_id = collections.id
          AND user_id = auth.uid()
          AND access_type IN ('view', 'edit')
        )
      )
    )
  );

CREATE POLICY "products_insert"
  ON products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admin can insert products
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
    OR
    -- User has edit access to the parent collection
    EXISTS (
      SELECT 1 FROM collections
      WHERE id = collection_id
      AND (
        user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM collection_access
          WHERE collection_id = collections.id
          AND user_id = auth.uid()
          AND access_type = 'edit'
        )
      )
    )
  );

CREATE POLICY "products_update"
  ON products
  FOR UPDATE
  TO authenticated
  USING (
    -- Admin can update products
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
    OR
    -- User has edit access to the parent collection
    EXISTS (
      SELECT 1 FROM collections
      WHERE id = collection_id
      AND (
        user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM collection_access
          WHERE collection_id = collections.id
          AND user_id = auth.uid()
          AND access_type = 'edit'
        )
      )
    )
  );

CREATE POLICY "products_delete"
  ON products
  FOR DELETE
  TO authenticated
  USING (
    -- Admin can delete products
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
    OR
    -- User has edit access to the parent collection
    EXISTS (
      SELECT 1 FROM collections
      WHERE id = collection_id
      AND (
        user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM collection_access
          WHERE collection_id = collections.id
          AND user_id = auth.uid()
          AND access_type = 'edit'
        )
      )
    )
  );

-- Create RLS policies for orders
CREATE POLICY "orders_select"
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
    -- User has access to the parent collection
    EXISTS (
      SELECT 1 FROM products
      JOIN collections ON collections.id = products.collection_id
      WHERE products.id = product_id
      AND (
        collections.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM collection_access
          WHERE collection_id = collections.id
          AND user_id = auth.uid()
          AND access_type IN ('view', 'edit')
        )
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
    -- User has edit access to the parent collection
    EXISTS (
      SELECT 1 FROM products
      JOIN collections ON collections.id = products.collection_id
      WHERE products.id = product_id
      AND (
        collections.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM collection_access
          WHERE collection_id = collections.id
          AND user_id = auth.uid()
          AND access_type = 'edit'
        )
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
    -- User has edit access to the parent collection
    EXISTS (
      SELECT 1 FROM products
      JOIN collections ON collections.id = products.collection_id
      WHERE products.id = product_id
      AND (
        collections.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM collection_access
          WHERE collection_id = collections.id
          AND user_id = auth.uid()
          AND access_type = 'edit'
        )
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
    -- User has edit access to the parent collection
    EXISTS (
      SELECT 1 FROM products
      JOIN collections ON collections.id = products.collection_id
      WHERE products.id = product_id
      AND (
        collections.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM collection_access
          WHERE collection_id = collections.id
          AND user_id = auth.uid()
          AND access_type = 'edit'
        )
      )
    )
  ); 