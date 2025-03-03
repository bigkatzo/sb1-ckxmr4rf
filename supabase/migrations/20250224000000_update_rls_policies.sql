-- Drop existing policies first
DO $$ BEGIN
  DROP POLICY IF EXISTS "collections_view_policy" ON public.collections;
  DROP POLICY IF EXISTS "collections_edit_policy" ON public.collections;
  DROP POLICY IF EXISTS "collections_update_policy" ON public.collections;
  DROP POLICY IF EXISTS "collections_delete_policy" ON public.collections;
  DROP POLICY IF EXISTS "collections_featured_policy" ON public.collections;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Update the has_content_access function to handle merchant role
CREATE OR REPLACE FUNCTION has_content_access(
    p_user_id uuid,
    p_collection_id uuid DEFAULT NULL,
    p_category_id uuid DEFAULT NULL,
    p_product_id uuid DEFAULT NULL,
    p_required_level text DEFAULT 'view'
) RETURNS boolean AS $$
DECLARE
    v_is_admin boolean;
    v_is_merchant boolean;
    v_has_access boolean;
    v_parent_collection_id uuid;
BEGIN
    -- Check if user is admin or merchant
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = p_user_id AND role = 'admin'
    ) INTO v_is_admin;

    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = p_user_id AND role IN ('admin', 'merchant')
    ) INTO v_is_merchant;

    -- Admins always have access
    IF v_is_admin THEN
        RETURN true;
    END IF;

    -- For collections, merchants can create new ones
    IF p_collection_id IS NOT NULL AND p_required_level = 'create' AND v_is_merchant THEN
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
    -- Allow merchants to create collections
    (SELECT role IN ('admin', 'merchant') FROM public.user_profiles WHERE id = auth.uid())
    OR
    -- Allow users with edit access
    has_content_access(auth.uid(), id, NULL, NULL, 'edit')
);

CREATE POLICY "collections_update_policy"
ON public.collections
FOR UPDATE
TO authenticated
USING (
    has_content_access(auth.uid(), id, NULL, NULL, 'edit')
)
WITH CHECK (
    -- For featured status updates, only allow admins
    CASE 
        WHEN NEW.featured IS DISTINCT FROM OLD.featured THEN
            (SELECT role = 'admin' FROM public.user_profiles WHERE id = auth.uid())
        ELSE
            has_content_access(auth.uid(), id, NULL, NULL, 'edit')
    END
);

CREATE POLICY "collections_delete_policy"
ON public.collections
FOR DELETE
TO authenticated
USING (
    has_content_access(auth.uid(), id, NULL, NULL, 'edit')
); 