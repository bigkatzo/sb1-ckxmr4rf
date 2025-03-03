-- Start transaction
BEGIN;

-- Drop any existing policies
DROP POLICY IF EXISTS "collections_view" ON collections;
DROP POLICY IF EXISTS "collections_modify" ON collections;
DROP POLICY IF EXISTS "products_view" ON products;
DROP POLICY IF EXISTS "products_modify" ON products;
DROP POLICY IF EXISTS "categories_view" ON categories;
DROP POLICY IF EXISTS "categories_modify" ON categories;
DROP POLICY IF EXISTS "orders_view" ON orders;
DROP POLICY IF EXISTS "orders_modify" ON orders;

-- Drop collection access helper functions but keep auth.is_admin()
DROP FUNCTION IF EXISTS auth.check_collection_access(uuid, text);
DROP FUNCTION IF EXISTS auth.has_collection_access(uuid);

-- Enable RLS on all tables
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Collections Policies
CREATE POLICY "collections_view"
ON collections
FOR SELECT
TO authenticated
USING (
  -- Public collections are visible
  visible = true
  OR
  -- Users can view their own collections
  user_id = auth.uid()
  OR
  -- Users with explicit access can view collections
  EXISTS (
    SELECT 1 FROM collection_access
    WHERE collection_id = id
    AND user_id = auth.uid()
    AND access_type IN ('view', 'edit')
  )
  OR
  -- Admins can view all collections
  auth.is_admin()
);

CREATE POLICY "collections_modify"
ON collections
FOR ALL
TO authenticated
USING (
  -- Users can modify their own collections
  user_id = auth.uid()
  OR
  -- Users with edit access can modify collections
  EXISTS (
    SELECT 1 FROM collection_access
    WHERE collection_id = id
    AND user_id = auth.uid()
    AND access_type = 'edit'
  )
  OR
  -- Admins can modify all collections
  auth.is_admin()
);

-- Products Policies
CREATE POLICY "products_view"
ON products
FOR SELECT
TO authenticated
USING (
  -- Users can view products in collections they have access to
  EXISTS (
    SELECT 1 FROM collections c
    WHERE c.id = collection_id
    AND (
      c.visible = true
      OR c.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM collection_access ca
        WHERE ca.collection_id = c.id
        AND ca.user_id = auth.uid()
        AND ca.access_type IN ('view', 'edit')
      )
      OR auth.is_admin()
    )
  )
);

CREATE POLICY "products_modify"
ON products
FOR ALL
TO authenticated
USING (
  -- Users can modify products in collections they own
  EXISTS (
    SELECT 1 FROM collections
    WHERE id = collection_id
    AND user_id = auth.uid()
  )
  OR
  -- Users with edit access can modify products
  EXISTS (
    SELECT 1 FROM collection_access
    WHERE collection_id = products.collection_id
    AND user_id = auth.uid()
    AND access_type = 'edit'
  )
  OR
  -- Admins can modify all products
  auth.is_admin()
);

-- Categories Policies
CREATE POLICY "categories_view"
ON categories
FOR SELECT
TO authenticated
USING (
  -- Users can view categories in collections they have access to
  EXISTS (
    SELECT 1 FROM collections c
    WHERE c.id = collection_id
    AND (
      c.visible = true
      OR c.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM collection_access ca
        WHERE ca.collection_id = c.id
        AND ca.user_id = auth.uid()
        AND ca.access_type IN ('view', 'edit')
      )
      OR auth.is_admin()
    )
  )
);

CREATE POLICY "categories_modify"
ON categories
FOR ALL
TO authenticated
USING (
  -- Users can modify categories in collections they own
  EXISTS (
    SELECT 1 FROM collections
    WHERE id = collection_id
    AND user_id = auth.uid()
  )
  OR
  -- Users with edit access can modify categories
  EXISTS (
    SELECT 1 FROM collection_access
    WHERE collection_id = categories.collection_id
    AND user_id = auth.uid()
    AND access_type = 'edit'
  )
  OR
  -- Admins can modify all categories
  auth.is_admin()
);

-- Orders Policies
CREATE POLICY "orders_view"
ON orders
FOR SELECT
TO authenticated
USING (
  -- Users can view their own orders
  user_id = auth.uid()
  OR
  -- Collection owners can view orders for their collections
  EXISTS (
    SELECT 1 FROM collections c
    JOIN order_items oi ON oi.product_id = ANY(order_items)
    JOIN products p ON p.id = oi.product_id
    WHERE p.collection_id = c.id
    AND c.user_id = auth.uid()
  )
  OR
  -- Users with edit access can view orders
  EXISTS (
    SELECT 1 FROM collections c
    JOIN order_items oi ON oi.product_id = ANY(order_items)
    JOIN products p ON p.id = oi.product_id
    JOIN collection_access ca ON ca.collection_id = c.id
    WHERE ca.user_id = auth.uid()
    AND ca.access_type = 'edit'
  )
  OR
  -- Admins can view all orders
  auth.is_admin()
);

CREATE POLICY "orders_modify"
ON orders
FOR ALL
TO authenticated
USING (
  -- Users can modify their own orders
  user_id = auth.uid()
  OR
  -- Collection owners can modify orders for their collections
  EXISTS (
    SELECT 1 FROM collections c
    JOIN order_items oi ON oi.product_id = ANY(order_items)
    JOIN products p ON p.id = oi.product_id
    WHERE p.collection_id = c.id
    AND c.user_id = auth.uid()
  )
  OR
  -- Users with edit access can modify orders
  EXISTS (
    SELECT 1 FROM collections c
    JOIN order_items oi ON oi.product_id = ANY(order_items)
    JOIN products p ON p.id = oi.product_id
    JOIN collection_access ca ON ca.collection_id = c.id
    WHERE ca.user_id = auth.uid()
    AND ca.access_type = 'edit'
  )
  OR
  -- Admins can modify all orders
  auth.is_admin()
);

-- Create indexes to optimize the policy checks
CREATE INDEX IF NOT EXISTS idx_collection_access_user_collection ON collection_access(user_id, collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_access_type ON collection_access(access_type);
CREATE INDEX IF NOT EXISTS idx_collections_user ON collections(user_id);
CREATE INDEX IF NOT EXISTS idx_products_collection ON products(collection_id);
CREATE INDEX IF NOT EXISTS idx_categories_collection ON categories(collection_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);

-- Verify all policies were created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename IN ('collections', 'products', 'categories', 'orders')
    AND policyname IN (
      'collections_view', 'collections_modify',
      'products_view', 'products_modify',
      'categories_view', 'categories_modify',
      'orders_view', 'orders_modify'
    )
  ) THEN
    RAISE EXCEPTION 'Policy creation failed';
  END IF;
END $$;

COMMIT; 