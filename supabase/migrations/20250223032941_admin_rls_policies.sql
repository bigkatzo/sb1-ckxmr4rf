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

-- Create the hierarchical access control function
CREATE OR REPLACE FUNCTION has_content_access(
    p_user_id uuid,
    p_collection_id uuid DEFAULT NULL,
    p_category_id uuid DEFAULT NULL,
    p_product_id uuid DEFAULT NULL,
    p_required_level text DEFAULT 'view'
) RETURNS boolean AS $$
DECLARE
    v_is_admin boolean;
    v_has_access boolean;
    v_parent_collection_id uuid;
BEGIN
    -- Check if user is admin
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = p_user_id AND role = 'admin'
    ) INTO v_is_admin;

    -- Admins always have access
    IF v_is_admin THEN
        RETURN true;
    END IF;

    -- If checking category or product access, first get their parent collection
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

    -- Check if user owns the content or its parent collection
    SELECT EXISTS (
        SELECT 1
        FROM public.collections c
        WHERE c.user_id = p_user_id
        AND (
            c.id = COALESCE(p_collection_id, v_parent_collection_id)
            OR EXISTS (
                SELECT 1
                FROM public.categories cat
                WHERE cat.collection_id = c.id
                AND (
                    cat.id = p_category_id
                    OR EXISTS (
                        SELECT 1
                        FROM public.products p
                        WHERE p.category_id = cat.id
                        AND p.id = p_product_id
                    )
                )
            )
        )
    ) INTO v_has_access;

    -- If user doesn't own it, check for explicit access
    IF NOT v_has_access THEN
        SELECT EXISTS (
            SELECT 1
            FROM public.collection_access ca
            WHERE ca.user_id = p_user_id
            AND (
                -- Direct access to requested content
                (p_collection_id IS NOT NULL AND ca.collection_id = p_collection_id)
                OR (p_category_id IS NOT NULL AND ca.collection_id = v_parent_collection_id)
                OR (p_product_id IS NOT NULL AND ca.collection_id = v_parent_collection_id)
            )
            AND (
                p_required_level = 'view' 
                OR (p_required_level = 'edit' AND ca.access_type = 'edit')
            )
        ) INTO v_has_access;
    END IF;

    RETURN v_has_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on all tables
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for collections
CREATE POLICY "collections_view_policy"
ON public.collections
FOR SELECT
TO authenticated
USING (
    has_content_access(auth.uid(), id, NULL, NULL, 'view')
);

CREATE POLICY "collections_edit_policy"
ON public.collections
FOR INSERT
TO authenticated
USING (
    has_content_access(auth.uid(), id, NULL, NULL, 'edit')
);

CREATE POLICY "collections_update_policy"
ON public.collections
FOR UPDATE
TO authenticated
USING (
    has_content_access(auth.uid(), id, NULL, NULL, 'edit')
);

CREATE POLICY "collections_delete_policy"
ON public.collections
FOR DELETE
TO authenticated
USING (
    has_content_access(auth.uid(), id, NULL, NULL, 'edit')
);

-- Create RLS policies for categories
CREATE POLICY "categories_view_policy"
ON public.categories
FOR SELECT
TO authenticated
USING (
    has_content_access(auth.uid(), collection_id, id, NULL, 'view')
);

CREATE POLICY "categories_edit_policy"
ON public.categories
FOR INSERT
TO authenticated
USING (
    has_content_access(auth.uid(), collection_id, id, NULL, 'edit')
);

CREATE POLICY "categories_update_policy"
ON public.categories
FOR UPDATE
TO authenticated
USING (
    has_content_access(auth.uid(), collection_id, id, NULL, 'edit')
);

CREATE POLICY "categories_delete_policy"
ON public.categories
FOR DELETE
TO authenticated
USING (
    has_content_access(auth.uid(), collection_id, id, NULL, 'edit')
);

-- 3.1 Storefront Policy (Public Access)
CREATE POLICY "categories_storefront_view"
ON categories
FOR SELECT
TO public
USING (
  -- Only show categories from visible collections that are also visible themselves
  EXISTS (
    SELECT 1 FROM collections c
    WHERE c.id = collection_id
    AND c.visible = true
  )
  AND visible = true
);

-- Create RLS policies for products
CREATE POLICY "products_view_policy"
ON public.products
FOR SELECT
TO authenticated
USING (
    has_content_access(auth.uid(), NULL, category_id, id, 'view')
);

CREATE POLICY "products_edit_policy"
ON public.products
FOR INSERT
TO authenticated
USING (
    has_content_access(auth.uid(), NULL, category_id, id, 'edit')
);

CREATE POLICY "products_update_policy"
ON public.products
FOR UPDATE
TO authenticated
USING (
    has_content_access(auth.uid(), NULL, category_id, id, 'edit')
);

CREATE POLICY "products_delete_policy"
ON public.products
FOR DELETE
TO authenticated
USING (
    has_content_access(auth.uid(), NULL, category_id, id, 'edit')
);

-- Create RLS policies for orders
CREATE POLICY "orders_view_policy"
ON public.orders
FOR SELECT
TO authenticated
USING (
    has_content_access(auth.uid(), NULL, NULL, product_id, 'view')
);

CREATE POLICY "orders_edit_policy"
ON public.orders
FOR INSERT
TO authenticated
USING (
    has_content_access(auth.uid(), NULL, NULL, product_id, 'edit')
);

CREATE POLICY "orders_update_policy"
ON public.orders
FOR UPDATE
TO authenticated
USING (
    has_content_access(auth.uid(), NULL, NULL, product_id, 'edit')
);

CREATE POLICY "orders_delete_policy"
ON public.orders
FOR DELETE
TO authenticated
USING (
    has_content_access(auth.uid(), NULL, NULL, product_id, 'edit')
);

-- Drop existing views if they exist
DROP VIEW IF EXISTS public_collections CASCADE;
DROP VIEW IF EXISTS public_products CASCADE;
DROP VIEW IF EXISTS public_categories CASCADE;

-- Create the views
CREATE VIEW public_collections AS
SELECT 
  id,
  name,
  description,
  image_url,
  launch_date,
  featured,
  visible,
  sale_ended,
  slug
FROM collections
WHERE visible = true;

CREATE VIEW public_products AS
SELECT 
  p.id,
  p.name,
  p.description,
  p.price,
  p.images,
  p.quantity,
  p.minimum_order_quantity,
  p.category_id,
  p.variants,
  p.variant_prices,
  p.slug,
  c.id as collection_id,
  c.name as collection_name,
  c.slug as collection_slug,
  c.launch_date as collection_launch_date,
  c.sale_ended as collection_sale_ended
FROM products p
JOIN collections c ON c.id = p.collection_id
WHERE c.visible = true;

CREATE VIEW public_categories AS
SELECT 
  cat.id,
  cat.name,
  cat.description,
  cat.type,
  cat.visible,
  cat.eligibility_rules,
  cat.collection_id
FROM categories cat
JOIN collections c ON c.id = cat.collection_id
WHERE c.visible = true
  AND cat.visible = true;

-- Grant access to the public views
GRANT SELECT ON public_collections TO anon;
GRANT SELECT ON public_products TO anon;
GRANT SELECT ON public_categories TO anon; 