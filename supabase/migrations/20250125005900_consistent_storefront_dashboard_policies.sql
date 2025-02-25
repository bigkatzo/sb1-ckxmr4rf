-- Start transaction
BEGIN;

-- Drop existing policies
DROP POLICY IF EXISTS "collections_view" ON collections;
DROP POLICY IF EXISTS "collections_edit" ON collections;
DROP POLICY IF EXISTS "collections_insert" ON collections;
DROP POLICY IF EXISTS "collections_update" ON collections;
DROP POLICY IF EXISTS "collections_delete" ON collections;
DROP POLICY IF EXISTS "collections_storefront_view" ON collections;
DROP POLICY IF EXISTS "collections_dashboard_view" ON collections;
DROP POLICY IF EXISTS "collections_dashboard_modify" ON collections;

DROP POLICY IF EXISTS "products_view" ON products;
DROP POLICY IF EXISTS "products_edit" ON products;
DROP POLICY IF EXISTS "products_policy" ON products;
DROP POLICY IF EXISTS "products_storefront_view" ON products;
DROP POLICY IF EXISTS "products_dashboard_view" ON products;
DROP POLICY IF EXISTS "products_dashboard_modify" ON products;

DROP POLICY IF EXISTS "categories_view" ON categories;
DROP POLICY IF EXISTS "categories_edit" ON categories;
DROP POLICY IF EXISTS "categories_policy" ON categories;
DROP POLICY IF EXISTS "categories_storefront_view" ON categories;
DROP POLICY IF EXISTS "categories_dashboard_view" ON categories;
DROP POLICY IF EXISTS "categories_dashboard_modify" ON categories;

-- Enable RLS
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- 1. Collections Policies

-- 1.1 Storefront Policy (Public Access)
CREATE POLICY "collections_storefront_view"
ON collections
FOR SELECT
TO public
USING (
  -- Only show collections marked as visible to the public
  visible = true
);

-- 1.2 Dashboard Policies (Authenticated Access)
CREATE POLICY "collections_dashboard_view"
ON collections
FOR SELECT
TO authenticated
USING (
  -- Users can view collections they own
  user_id = auth.uid()
  OR
  -- Users can view collections they have access to
  EXISTS (
    SELECT 1 FROM collection_access ca
    WHERE ca.collection_id = id
    AND ca.user_id = auth.uid()
  )
  OR
  -- Admins can view all
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'admin'
  )
);

CREATE POLICY "collections_dashboard_modify"
ON collections
FOR ALL
TO authenticated
USING (
  -- Users can modify their own collections
  user_id = auth.uid()
  OR
  -- Users with edit access can modify
  EXISTS (
    SELECT 1 FROM collection_access ca
    WHERE ca.collection_id = id
    AND ca.user_id = auth.uid()
    AND ca.access_type = 'edit'
  )
  OR
  -- Admins can modify all
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'admin'
  )
);

-- 2. Products Policies

-- 2.1 Storefront Policy (Public Access)
CREATE POLICY "products_storefront_view"
ON products
FOR SELECT
TO public
USING (
  -- Only show products from visible collections
  EXISTS (
    SELECT 1 FROM collections c
    WHERE c.id = collection_id
    AND c.visible = true
  )
);

-- 2.2 Dashboard Policies (Authenticated Access)
CREATE POLICY "products_dashboard_view"
ON products
FOR SELECT
TO authenticated
USING (
  -- Users can view products from collections they own
  EXISTS (
    SELECT 1 FROM collections c
    WHERE c.id = collection_id
    AND c.user_id = auth.uid()
  )
  OR
  -- Users can view products from collections they have access to
  EXISTS (
    SELECT 1 FROM collections c
    JOIN collection_access ca ON ca.collection_id = c.id
    WHERE c.id = collection_id
    AND ca.user_id = auth.uid()
  )
  OR
  -- Admins can view all
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'admin'
  )
);

CREATE POLICY "products_dashboard_modify"
ON products
FOR ALL
TO authenticated
USING (
  -- Users can modify products from collections they own
  EXISTS (
    SELECT 1 FROM collections c
    WHERE c.id = collection_id
    AND c.user_id = auth.uid()
  )
  OR
  -- Users with edit access can modify
  EXISTS (
    SELECT 1 FROM collections c
    JOIN collection_access ca ON ca.collection_id = c.id
    WHERE c.id = collection_id
    AND ca.user_id = auth.uid()
    AND ca.access_type = 'edit'
  )
  OR
  -- Admins can modify all
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'admin'
  )
);

-- 3. Categories Policies

-- 3.1 Storefront Policy (Public Access)
CREATE POLICY "categories_storefront_view"
ON categories
FOR SELECT
TO public
USING (
  -- Only show categories from visible collections
  EXISTS (
    SELECT 1 FROM collections c
    WHERE c.id = collection_id
    AND c.visible = true
  )
);

-- 3.2 Dashboard Policies (Authenticated Access)
CREATE POLICY "categories_dashboard_view"
ON categories
FOR SELECT
TO authenticated
USING (
  -- Users can view categories from collections they own
  EXISTS (
    SELECT 1 FROM collections c
    WHERE c.id = collection_id
    AND c.user_id = auth.uid()
  )
  OR
  -- Users can view categories from collections they have access to
  EXISTS (
    SELECT 1 FROM collections c
    JOIN collection_access ca ON ca.collection_id = c.id
    WHERE c.id = collection_id
    AND ca.user_id = auth.uid()
  )
  OR
  -- Admins can view all
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'admin'
  )
);

CREATE POLICY "categories_dashboard_modify"
ON categories
FOR ALL
TO authenticated
USING (
  -- Users can modify categories from collections they own
  EXISTS (
    SELECT 1 FROM collections c
    WHERE c.id = collection_id
    AND c.user_id = auth.uid()
  )
  OR
  -- Users with edit access can modify
  EXISTS (
    SELECT 1 FROM collections c
    JOIN collection_access ca ON ca.collection_id = c.id
    WHERE c.id = collection_id
    AND ca.user_id = auth.uid()
    AND ca.access_type = 'edit'
  )
  OR
  -- Admins can modify all
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'admin'
  )
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_collections_visible ON collections(visible);
CREATE INDEX IF NOT EXISTS idx_collections_user_id ON collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collection_access_collection_id ON collection_access(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_access_user_id ON collection_access(user_id);
CREATE INDEX IF NOT EXISTS idx_collection_access_type ON collection_access(access_type);
CREATE INDEX IF NOT EXISTS idx_products_collection_id ON products(collection_id);
CREATE INDEX IF NOT EXISTS idx_categories_collection_id ON categories(collection_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(id) WHERE role = 'admin';

-- Verify policies were created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename IN ('collections', 'products', 'categories')
    AND policyname IN (
      'collections_storefront_view',
      'collections_dashboard_view',
      'collections_dashboard_modify',
      'products_storefront_view',
      'products_dashboard_view',
      'products_dashboard_modify',
      'categories_storefront_view',
      'categories_dashboard_view',
      'categories_dashboard_modify'
    )
  ) THEN
    RAISE EXCEPTION 'Policies not created properly';
  END IF;
END $$;

COMMIT; 