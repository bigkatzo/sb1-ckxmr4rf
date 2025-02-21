-- Optimized dashboard collection access control

-- Add unique constraint to collection_access if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'unique_user_content_access'
    ) THEN
        ALTER TABLE public.collection_access
        ADD CONSTRAINT unique_user_content_access 
        UNIQUE (user_id, collection_id, category_id, product_id) NULLS NOT DISTINCT;
    END IF;
END $$;

-- Enable RLS on tables
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_access ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
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
    -- Check admin status first - admins always have full access
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = p_user_id AND role = 'admin'::user_role
    ) INTO v_is_admin;

    -- Admins have full access to everything
    IF v_is_admin THEN
        RETURN true;
    END IF;

    -- For non-admins, check merchant status
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = p_user_id AND role = 'merchant'::user_role
    ) INTO v_is_merchant;

    -- Resolve parent collection ID with null safety
    IF p_category_id IS NOT NULL THEN
        SELECT collection_id INTO v_parent_collection_id
        FROM public.categories
        WHERE id = p_category_id;
        IF v_parent_collection_id IS NULL THEN
            RETURN false;
        END IF;
    ELSIF p_product_id IS NOT NULL THEN
        SELECT c.collection_id INTO v_parent_collection_id
        FROM public.products p
        JOIN public.categories c ON c.id = p.category_id
        WHERE p.id = p_product_id;
        IF v_parent_collection_id IS NULL THEN
            RETURN false;
        END IF;
    END IF;

    -- For non-admins, check explicit access or merchant ownership
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
            lower(p_required_level) = 'view'
            OR (lower(p_required_level) = 'edit' AND lower(ca.access_type) = 'edit')
        )
    ) OR (
        v_is_merchant AND EXISTS (
            SELECT 1
            FROM public.collections c
            LEFT JOIN public.categories cat ON cat.collection_id = c.id
            LEFT JOIN public.products p ON p.category_id = cat.id
            WHERE c.user_id = p_user_id
            AND (
                c.id = COALESCE(p_collection_id, v_parent_collection_id)
                OR cat.id = p_category_id
                OR p.id = p_product_id
            )
        )
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Add admin-specific policy for collections
CREATE POLICY "collections_admin_all_access"
ON public.collections
FOR ALL
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'::user_role)
);

-- Update policies to explicitly check admin status first
CREATE OR REPLACE POLICY "collection_access_view_own"
ON public.collection_access
FOR SELECT
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'::user_role)
    OR user_id = auth.uid()
);

-- Policies for categories with explicit admin check
CREATE OR REPLACE POLICY "categories_users_view_own_or_granted"
ON public.categories
FOR SELECT
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'::user_role)
    OR has_content_access(auth.uid(), collection_id, id, NULL, 'view')
);

CREATE OR REPLACE POLICY "categories_users_insert_own_or_granted"
ON public.categories
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'::user_role)
    OR has_content_access(auth.uid(), collection_id, NULL, NULL, 'edit')
);

CREATE OR REPLACE POLICY "categories_users_update_own_or_granted"
ON public.categories
FOR UPDATE
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'::user_role)
    OR has_content_access(auth.uid(), collection_id, id, NULL, 'edit')
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'::user_role)
    OR has_content_access(auth.uid(), collection_id, id, NULL, 'edit')
);

CREATE OR REPLACE POLICY "categories_users_delete_own_or_granted"
ON public.categories
FOR DELETE
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'::user_role)
    OR has_content_access(auth.uid(), collection_id, id, NULL, 'edit')
);

-- Policies for products with explicit admin check
CREATE OR REPLACE POLICY "products_users_view_own_or_granted"
ON public.products
FOR SELECT
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'::user_role)
    OR has_content_access(auth.uid(), NULL, category_id, id, 'view')
);

CREATE OR REPLACE POLICY "products_users_insert_own_or_granted"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'::user_role)
    OR has_content_access(auth.uid(), NULL, category_id, NULL, 'edit')
);

CREATE OR REPLACE POLICY "products_users_update_own_or_granted"
ON public.products
FOR UPDATE
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'::user_role)
    OR has_content_access(auth.uid(), NULL, category_id, id, 'edit')
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'::user_role)
    OR has_content_access(auth.uid(), NULL, category_id, id, 'edit')
);

CREATE OR REPLACE POLICY "products_users_delete_own_or_granted"
ON public.products
FOR DELETE
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'::user_role)
    OR has_content_access(auth.uid(), NULL, category_id, id, 'edit')
);

-- Update orders policies to check admin status first
CREATE OR REPLACE POLICY "orders_users_view_buyers"
ON public.orders
FOR SELECT
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'::user_role)
    OR wallet_address = auth.jwt()->>'wallet_address'
);

CREATE OR REPLACE POLICY "orders_users_view_dashboard"
ON public.orders
FOR SELECT
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'::user_role)
    OR EXISTS (
        SELECT 1
        FROM public.products p
        JOIN public.categories c ON c.id = p.category_id
        JOIN public.collections col ON col.id = c.collection_id
        WHERE p.id = orders.product_id
        AND (
            col.user_id = auth.uid()
            OR has_content_access(auth.uid(), col.id, c.id, p.id, 'view')
        )
    )
);

CREATE POLICY "orders_users_update_admin_only"
ON public.orders
FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'::user_role))
WITH CHECK (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'::user_role));

CREATE POLICY "orders_users_delete_admin_only"
ON public.orders
FOR DELETE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'admin'::user_role));

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
END $$;

-- Grant minimal required permissions
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT ON public.collection_access TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT ON public.orders TO authenticated;

-- Functions for managing collection access
DROP FUNCTION IF EXISTS public.grant_collection_access(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.grant_collection_access(uuid, uuid, uuid, uuid, text);
DROP FUNCTION IF EXISTS public.grant_content_access(uuid, uuid, uuid, uuid, text);
DROP FUNCTION IF EXISTS public.revoke_collection_access(uuid, uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.revoke_content_access(uuid, uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.grant_collection_access(
    p_user_id uuid,
    p_collection_id uuid DEFAULT NULL,
    p_category_id uuid DEFAULT NULL,
    p_product_id uuid DEFAULT NULL,
    p_access_type text DEFAULT 'view'
) RETURNS void AS $$
BEGIN
    -- Check admin status
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() AND role = 'admin'::user_role
    ) THEN
        RAISE EXCEPTION 'Only administrators can grant access';
    END IF;

    -- Validate access type (case-insensitive)
    IF lower(p_access_type) NOT IN ('view', 'edit') THEN
        RAISE EXCEPTION 'Invalid access type "%". Must be "view" or "edit"', p_access_type;
    END IF;

    -- Validate that at least one content ID is provided
    IF p_collection_id IS NULL AND p_category_id IS NULL AND p_product_id IS NULL THEN
        RAISE EXCEPTION 'Must specify at least one content item to grant access to';
    END IF;

    -- Insert or update access
    INSERT INTO public.collection_access (
        user_id,
        collection_id,
        category_id,
        product_id,
        access_type,
        granted_by
    )
    VALUES (
        p_user_id,
        p_collection_id,
        p_category_id,
        p_product_id,
        lower(p_access_type),
        auth.uid()
    )
    ON CONFLICT ON CONSTRAINT unique_user_content_access
    DO UPDATE SET
        access_type = EXCLUDED.access_type,
        granted_by = EXCLUDED.granted_by;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.revoke_content_access(
    p_user_id uuid,
    p_collection_id uuid DEFAULT NULL,
    p_category_id uuid DEFAULT NULL,
    p_product_id uuid DEFAULT NULL
) RETURNS void AS $$
BEGIN
    -- Check admin status
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() AND role = 'admin'::user_role
    ) THEN
        RAISE EXCEPTION 'Only administrators can revoke access';
    END IF;

    -- Delete access record
    DELETE FROM public.collection_access
    WHERE user_id = p_user_id
    AND collection_id IS NOT DISTINCT FROM p_collection_id
    AND category_id IS NOT DISTINCT FROM p_category_id
    AND product_id IS NOT DISTINCT FROM p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.grant_content_access(uuid, uuid, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_content_access(uuid, uuid, uuid, uuid) TO authenticated;

-- Verify setup
DO $$
BEGIN
    -- Check RLS status
    IF EXISTS (
        SELECT 1
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename = 'collections'
        AND rowsecurity = true
    ) THEN
        RAISE NOTICE 'RLS enabled for collections';
    ELSE
        RAISE WARNING 'RLS NOT enabled for collections';
    END IF;

    -- Check admin policy
    IF EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'collections'
        AND policyname = 'collections_admin_all_access'
    ) THEN
        RAISE NOTICE 'Admin policy configured for collections';
    ELSE
        RAISE WARNING 'Admin policy missing for collections';
    END IF;

    -- Check unique constraint
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'unique_user_content_access'
        AND contype = 'u'
    ) THEN
        RAISE NOTICE 'Unique constraint unique_user_content_access exists';
    ELSE
        RAISE WARNING 'Unique constraint unique_user_content_access missing';
    END IF;

    -- Check admin role exists
    IF EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'user_role'
        AND typtype = 'e'
    ) THEN
        RAISE NOTICE 'user_role enum type exists';
    ELSE
        RAISE WARNING 'user_role enum type missing';
    END IF;
END $$;
