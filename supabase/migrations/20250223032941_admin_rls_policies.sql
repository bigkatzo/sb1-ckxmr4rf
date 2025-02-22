-- Drop all existing policies
DO $$ BEGIN
  -- Drop collection policies
  DROP POLICY IF EXISTS "collections_policy" ON public.collections;
  DROP POLICY IF EXISTS "collections_access" ON public.collections;
  DROP POLICY IF EXISTS "collections_select" ON public.collections;
  DROP POLICY IF EXISTS "collections_insert" ON public.collections;
  DROP POLICY IF EXISTS "collections_update" ON public.collections;
  DROP POLICY IF EXISTS "collections_delete" ON public.collections;
  DROP POLICY IF EXISTS "collections_view" ON public.collections;
  DROP POLICY IF EXISTS "collections_edit" ON public.collections;
  DROP POLICY IF EXISTS "merchant_collections_view" ON public.collections;
  DROP POLICY IF EXISTS "merchant_collections_manage" ON public.collections;
  DROP POLICY IF EXISTS "merchant_collections_modify" ON public.collections;
  DROP POLICY IF EXISTS "merchant_collections_remove" ON public.collections;

  -- Drop category policies
  DROP POLICY IF EXISTS "categories_policy" ON public.categories;
  DROP POLICY IF EXISTS "categories_access" ON public.categories;
  DROP POLICY IF EXISTS "categories_select" ON public.categories;
  DROP POLICY IF EXISTS "categories_insert" ON public.categories;
  DROP POLICY IF EXISTS "categories_update" ON public.categories;
  DROP POLICY IF EXISTS "categories_delete" ON public.categories;
  DROP POLICY IF EXISTS "categories_view" ON public.categories;
  DROP POLICY IF EXISTS "categories_edit" ON public.categories;

  -- Drop product policies
  DROP POLICY IF EXISTS "products_policy" ON public.products;
  DROP POLICY IF EXISTS "products_access" ON public.products;
  DROP POLICY IF EXISTS "products_select" ON public.products;
  DROP POLICY IF EXISTS "products_insert" ON public.products;
  DROP POLICY IF EXISTS "products_update" ON public.products;
  DROP POLICY IF EXISTS "products_delete" ON public.products;
  DROP POLICY IF EXISTS "products_view" ON public.products;
  DROP POLICY IF EXISTS "products_edit" ON public.products;

  -- Drop order policies
  DROP POLICY IF EXISTS "orders_policy" ON public.orders;
  DROP POLICY IF EXISTS "orders_access" ON public.orders;
  DROP POLICY IF EXISTS "orders_select" ON public.orders;
  DROP POLICY IF EXISTS "orders_insert" ON public.orders;
  DROP POLICY IF EXISTS "orders_update" ON public.orders;
  DROP POLICY IF EXISTS "orders_delete" ON public.orders;
  DROP POLICY IF EXISTS "orders_view" ON public.orders;
  DROP POLICY IF EXISTS "orders_edit" ON public.orders;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Enable RLS on all tables
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for collections
CREATE POLICY "collections_select"
  ON public.collections
  FOR SELECT
  TO authenticated
  USING (
    -- Admin can view all collections
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE public.user_profiles.id = auth.uid()
      AND public.user_profiles.role = 'admin'
    )
    OR
    -- User owns the collection or has explicit access
    (public.collections.user_id = auth.uid()
     OR EXISTS (
       SELECT 1 FROM public.collection_access
       WHERE public.collection_access.collection_id = public.collections.id
       AND public.collection_access.user_id = auth.uid()
       AND public.collection_access.access_type IN ('view', 'edit')
     ))
  );

CREATE POLICY "collections_insert"
  ON public.collections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admin or owner can insert
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE public.user_profiles.id = auth.uid()
      AND public.user_profiles.role = 'admin'
    )
    OR public.collections.user_id = auth.uid()
  );

CREATE POLICY "collections_update"
  ON public.collections
  FOR UPDATE
  TO authenticated
  USING (
    -- Admin can update all, owner or edit access can update their own
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE public.user_profiles.id = auth.uid()
      AND public.user_profiles.role = 'admin'
    )
    OR
    (public.collections.user_id = auth.uid()
     OR EXISTS (
       SELECT 1 FROM public.collection_access
       WHERE public.collection_access.collection_id = public.collections.id
       AND public.collection_access.user_id = auth.uid()
       AND public.collection_access.access_type = 'edit'
     ))
  );

CREATE POLICY "collections_delete"
  ON public.collections
  FOR DELETE
  TO authenticated
  USING (
    -- Admin or owner can delete
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE public.user_profiles.id = auth.uid()
      AND public.user_profiles.role = 'admin'
    )
    OR public.collections.user_id = auth.uid()
  );

-- Create RLS policies for categories
CREATE POLICY "categories_select"
  ON public.categories
  FOR SELECT
  TO authenticated
  USING (
    -- Admin can view all categories
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE public.user_profiles.id = auth.uid()
      AND public.user_profiles.role = 'admin'
    )
    OR
    -- User has access to the parent collection
    EXISTS (
      SELECT 1 FROM public.collections
      WHERE public.collections.id = public.categories.collection_id
      AND (public.collections.user_id = auth.uid()
           OR EXISTS (
             SELECT 1 FROM public.collection_access
             WHERE public.collection_access.collection_id = public.collections.id
             AND public.collection_access.user_id = auth.uid()
             AND public.collection_access.access_type IN ('view', 'edit')
           ))
    )
  );

CREATE POLICY "categories_insert"
  ON public.categories
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE public.user_profiles.id = auth.uid()
      AND public.user_profiles.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.collections
      WHERE public.collections.id = public.categories.collection_id
      AND (public.collections.user_id = auth.uid()
           OR EXISTS (
             SELECT 1 FROM public.collection_access
             WHERE public.collection_access.collection_id = public.collections.id
             AND public.collection_access.user_id = auth.uid()
             AND public.collection_access.access_type = 'edit'
           ))
    )
  );

CREATE POLICY "categories_update"
  ON public.categories
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE public.user_profiles.id = auth.uid()
      AND public.user_profiles.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.collections
      WHERE public.collections.id = public.categories.collection_id
      AND (public.collections.user_id = auth.uid()
           OR EXISTS (
             SELECT 1 FROM public.collection_access
             WHERE public.collection_access.collection_id = public.collections.id
             AND public.collection_access.user_id = auth.uid()
             AND public.collection_access.access_type = 'edit'
           ))
    )
  );

CREATE POLICY "categories_delete"
  ON public.categories
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE public.user_profiles.id = auth.uid()
      AND public.user_profiles.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.collections
      WHERE public.collections.id = public.categories.collection_id
      AND (public.collections.user_id = auth.uid()
           OR EXISTS (
             SELECT 1 FROM public.collection_access
             WHERE public.collection_access.collection_id = public.collections.id
             AND public.collection_access.user_id = auth.uid()
             AND public.collection_access.access_type = 'edit'
           ))
    )
  );

-- Create RLS policies for products
CREATE POLICY "products_select"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE public.user_profiles.id = auth.uid()
      AND public.user_profiles.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.collections
      WHERE public.collections.id = public.products.collection_id
      AND (public.collections.user_id = auth.uid()
           OR EXISTS (
             SELECT 1 FROM public.collection_access
             WHERE public.collection_access.collection_id = public.collections.id
             AND public.collection_access.user_id = auth.uid()
             AND public.collection_access.access_type IN ('view', 'edit')
           ))
    )
  );

CREATE POLICY "products_insert"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE public.user_profiles.id = auth.uid()
      AND public.user_profiles.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.collections
      WHERE public.collections.id = public.products.collection_id
      AND (public.collections.user_id = auth.uid()
           OR EXISTS (
             SELECT 1 FROM public.collection_access
             WHERE public.collection_access.collection_id = public.collections.id
             AND public.collection_access.user_id = auth.uid()
             AND public.collection_access.access_type = 'edit'
           ))
    )
  );

CREATE POLICY "products_update"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE public.user_profiles.id = auth.uid()
      AND public.user_profiles.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.collections
      WHERE public.collections.id = public.products.collection_id
      AND (public.collections.user_id = auth.uid()
           OR EXISTS (
             SELECT 1 FROM public.collection_access
             WHERE public.collection_access.collection_id = public.collections.id
             AND public.collection_access.user_id = auth.uid()
             AND public.collection_access.access_type = 'edit'
           ))
    )
  );

CREATE POLICY "products_delete"
  ON public.products
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE public.user_profiles.id = auth.uid()
      AND public.user_profiles.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.collections
      WHERE public.collections.id = public.products.collection_id
      AND (public.collections.user_id = auth.uid()
           OR EXISTS (
             SELECT 1 FROM public.collection_access
             WHERE public.collection_access.collection_id = public.collections.id
             AND public.collection_access.user_id = auth.uid()
             AND public.collection_access.access_type = 'edit'
           ))
    )
  );

-- Create RLS policies for orders
CREATE POLICY "orders_select"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE public.user_profiles.id = auth.uid()
      AND public.user_profiles.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.products
      JOIN public.collections ON public.collections.id = public.products.collection_id
      WHERE public.products.id = public.orders.product_id
      AND (public.collections.user_id = auth.uid()
           OR EXISTS (
             SELECT 1 FROM public.collection_access
             WHERE public.collection_access.collection_id = public.collections.id
             AND public.collection_access.user_id = auth.uid()
             AND public.collection_access.access_type IN ('view', 'edit')
           ))
    )
  );

CREATE POLICY "orders_insert"
  ON public.orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE public.user_profiles.id = auth.uid()
      AND public.user_profiles.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.products
      JOIN public.collections ON public.collections.id = public.products.collection_id
      WHERE public.products.id = public.orders.product_id
      AND (public.collections.user_id = auth.uid()
           OR EXISTS (
             SELECT 1 FROM public.collection_access
             WHERE public.collection_access.collection_id = public.collections.id
             AND public.collection_access.user_id = auth.uid()
             AND public.collection_access.access_type = 'edit'
           ))
    )
  );

CREATE POLICY "orders_update"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE public.user_profiles.id = auth.uid()
      AND public.user_profiles.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.products
      JOIN public.collections ON public.collections.id = public.products.collection_id
      WHERE public.products.id = public.orders.product_id
      AND (public.collections.user_id = auth.uid()
           OR EXISTS (
             SELECT 1 FROM public.collection_access
             WHERE public.collection_access.collection_id = public.collections.id
             AND public.collection_access.user_id = auth.uid()
             AND public.collection_access.access_type = 'edit'
           ))
    )
  );

CREATE POLICY "orders_delete"
  ON public.orders
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE public.user_profiles.id = auth.uid()
      AND public.user_profiles.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.products
      JOIN public.collections ON public.collections.id = public.products.collection_id
      WHERE public.products.id = public.orders.product_id
      AND (public.collections.user_id = auth.uid()
           OR EXISTS (
             SELECT 1 FROM public.collection_access
             WHERE public.collection_access.collection_id = public.collections.id
             AND public.collection_access.user_id = auth.uid()
             AND public.collection_access.access_type = 'edit'
           ))
    )
  ); 