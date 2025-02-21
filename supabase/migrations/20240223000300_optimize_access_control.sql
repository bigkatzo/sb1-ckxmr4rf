-- Drop existing policies for relevant tables
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN (
        SELECT policyname, tablename
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename IN ('categories', 'products', 'orders', 'collection_access')
    )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- Ensure RLS is enabled
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_access ENABLE ROW LEVEL SECURITY;

-- Create user_role type if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('admin', 'merchant', 'user');
    END IF;
END $$;

-- Optimized has_content_access function
CREATE OR REPLACE FUNCTION public.has_content_access(
    p_user_id uuid,
    p_collection_id uuid DEFAULT NULL,
    p_category_id uuid DEFAULT NULL,
    p_product_id uuid DEFAULT NULL,
    p_required_level text DEFAULT 'view'
) RETURNS boolean AS $$
DECLARE
    v_is_admin boolean;
    v_is_merchant boolean;
    v_parent_collection_id uuid;
BEGIN
    -- Check admin status using auth.is_admin()
    v_is_admin := auth.is_admin();

    IF v_is_admin THEN
        RETURN true;
    END IF;

    -- Check merchant status (cached for performance)
    SELECT role = 'merchant'::user_role INTO v_is_merchant
    FROM public.user_profiles 
    WHERE user_id = p_user_id;

    -- Resolve parent collection ID (single query path)
    IF p_category_id IS NOT NULL THEN
        SELECT collection_id INTO v_parent_collection_id
        FROM public.categories
        WHERE id = p_category_id;
    ELSIF p_product_id IS NOT NULL THEN
        SELECT c.collection_id INTO v_parent_collection_id
        FROM public.products p
        JOIN public.categories c ON c.id = p.category_id
        WHERE p.id = p_product_id;
    END IF;

    -- Check explicit or inherited access (optimized single query)
    RETURN EXISTS (
        SELECT 1
        FROM public.collection_access ca
        WHERE ca.user_id = p_user_id
        AND (
            (p_collection_id IS NOT NULL AND ca.collection_id = p_collection_id)
            OR (p_category_id IS NOT NULL AND ca.category_id = p_category_id)
            OR (p_product_id IS NOT NULL AND ca.product_id = p_product_id)
            OR (v_parent_collection_id IS NOT NULL AND ca.collection_id = v_parent_collection_id)
        )
        AND (
            p_required_level = 'view'
            OR (p_required_level = 'edit' AND ca.access_type = 'edit')
        )
    ) OR (
        v_is_merchant AND EXISTS (
            SELECT 1
            FROM public.collections c
            LEFT JOIN public.categories cat ON cat.collection_id = c.id
            LEFT JOIN public.products p ON p.category_id = cat.id
            WHERE c.created_by = p_user_id
            AND (
                c.id = COALESCE(p_collection_id, v_parent_collection_id)
                OR cat.id = p_category_id
                OR p.id = p_product_id
            )
        )
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Collection access policies
CREATE POLICY "collection_access_users_view_own"
ON public.collection_access
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "collection_access_admin_all"
ON public.collection_access
FOR ALL
TO authenticated
USING (auth.is_admin())
WITH CHECK (auth.is_admin());

-- Categories policies with granular operations
CREATE POLICY "categories_users_view_own_or_granted"
ON public.categories
FOR SELECT
TO authenticated
USING (has_content_access(auth.uid(), collection_id, id, NULL, 'view'));

CREATE POLICY "categories_users_insert_own_or_granted"
ON public.categories
FOR INSERT
TO authenticated
WITH CHECK (
    has_content_access(auth.uid(), collection_id, NULL, NULL, 'edit')
);

CREATE POLICY "categories_users_update_own_or_granted"
ON public.categories
FOR UPDATE
TO authenticated
USING (has_content_access(auth.uid(), collection_id, id, NULL, 'edit'))
WITH CHECK (has_content_access(auth.uid(), collection_id, id, NULL, 'edit'));

CREATE POLICY "categories_users_delete_own_or_granted"
ON public.categories
FOR DELETE
TO authenticated
USING (has_content_access(auth.uid(), collection_id, id, NULL, 'edit'));

-- Products policies with granular operations
CREATE POLICY "products_users_view_own_or_granted"
ON public.products
FOR SELECT
TO authenticated
USING (has_content_access(auth.uid(), NULL, category_id, id, 'view'));

CREATE POLICY "products_users_insert_own_or_granted"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (
    has_content_access(auth.uid(), NULL, category_id, NULL, 'edit')
);

CREATE POLICY "products_users_update_own_or_granted"
ON public.products
FOR UPDATE
TO authenticated
USING (has_content_access(auth.uid(), NULL, category_id, id, 'edit'))
WITH CHECK (has_content_access(auth.uid(), NULL, category_id, id, 'edit'));

CREATE POLICY "products_users_delete_own_or_granted"
ON public.products
FOR DELETE
TO authenticated
USING (has_content_access(auth.uid(), NULL, category_id, id, 'edit'));

-- Orders policies with granular operations
CREATE POLICY "orders_users_view_own_or_merchant_or_granted"
ON public.orders
FOR SELECT
TO authenticated
USING (
    auth.is_admin()
    OR user_id = auth.uid()
    OR EXISTS (
        SELECT 1
        FROM public.order_items oi
        JOIN public.products p ON p.id = oi.product_id
        JOIN public.categories c ON c.id = p.category_id
        JOIN public.collections col ON col.id = c.collection_id
        WHERE oi.order_id = orders.id
        AND (
            col.created_by = auth.uid() 
            OR has_content_access(auth.uid(), col.id, c.id, p.id, 'view')
        )
    )
);

CREATE POLICY "orders_users_insert_own"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (
    auth.is_admin()
    OR user_id = auth.uid()
);

CREATE POLICY "orders_users_update_admin_or_own"
ON public.orders
FOR UPDATE
TO authenticated
USING (
    auth.is_admin()
    OR user_id = auth.uid()
)
WITH CHECK (
    auth.is_admin()
    OR user_id = auth.uid()
);

CREATE POLICY "orders_users_delete_admin_only"
ON public.orders
FOR DELETE
TO authenticated
USING (auth.is_admin());

-- Add performance indexes
DO $$
BEGIN
    -- Collection access indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_collection_access_user_id') THEN
        CREATE INDEX idx_collection_access_user_id ON public.collection_access(user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_collection_access_collection_id') THEN
        CREATE INDEX idx_collection_access_collection_id ON public.collection_access(collection_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_collection_access_category_id') THEN
        CREATE INDEX idx_collection_access_category_id ON public.collection_access(category_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_collection_access_product_id') THEN
        CREATE INDEX idx_collection_access_product_id ON public.collection_access(product_id);
    END IF;

    -- Categories indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_categories_collection_id') THEN
        CREATE INDEX idx_categories_collection_id ON public.categories(collection_id);
    END IF;

    -- Products indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_products_category_id') THEN
        CREATE INDEX idx_products_category_id ON public.products(category_id);
    END IF;

    -- Orders and order items indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_orders_user_id') THEN
        CREATE INDEX idx_orders_user_id ON public.orders(user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_order_items_order_id') THEN
        CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_order_items_product_id') THEN
        CREATE INDEX idx_order_items_product_id ON public.order_items(product_id);
    END IF;
END $$;

-- Grant minimal required permissions
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT ON public.collection_access TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT SELECT ON public.order_items TO authenticated;

-- Verify setup
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (VALUES 
        ('categories'), 
        ('products'), 
        ('orders'),
        ('collection_access')
    )
    LOOP
        IF EXISTS (
            SELECT 1
            FROM pg_tables
            WHERE schemaname = 'public'
            AND tablename = r.column1
            AND rowsecurity = true
        ) THEN
            RAISE NOTICE 'RLS enabled for %', r.column1;
        ELSE
            RAISE WARNING 'RLS NOT enabled for %', r.column1;
        END IF;
    END LOOP;
END $$; 