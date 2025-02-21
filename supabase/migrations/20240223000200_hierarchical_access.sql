-- Update the has_content_access function to implement hierarchical access
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
    -- Check if user is admin
    SELECT EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE user_id = p_user_id AND role = 'admin'
    ) INTO v_is_admin;

    -- Admins always have access
    IF v_is_admin THEN
        RETURN true;
    END IF;

    -- Check if user is merchant
    SELECT EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE user_id = p_user_id AND role = 'merchant'
    ) INTO v_is_merchant;

    -- If checking category or product access, first get their parent collection
    IF p_category_id IS NOT NULL THEN
        SELECT collection_id INTO v_parent_collection_id
        FROM categories
        WHERE id = p_category_id;
    ELSIF p_product_id IS NOT NULL THEN
        SELECT c.collection_id INTO v_parent_collection_id
        FROM products p
        JOIN categories c ON c.id = p.category_id
        WHERE p.id = p_product_id;
    END IF;

    -- Check if user has explicit access to the content or its parent collection
    SELECT EXISTS (
        SELECT 1
        FROM collection_access ca
        WHERE ca.user_id = p_user_id
        AND (
            -- Direct access to requested content
            (p_collection_id IS NOT NULL AND ca.collection_id = p_collection_id)
            OR (p_category_id IS NOT NULL AND ca.category_id = p_category_id)
            OR (p_product_id IS NOT NULL AND ca.product_id = p_product_id)
            -- Access through parent collection
            OR (v_parent_collection_id IS NOT NULL AND ca.collection_id = v_parent_collection_id)
        )
        AND (
            p_required_level = 'view' 
            OR (p_required_level = 'edit' AND ca.access_type = 'edit')
        )
    ) INTO v_has_access;

    -- If user is a merchant, check if they own the content or its parent collection
    IF v_is_merchant AND NOT v_has_access THEN
        SELECT EXISTS (
            SELECT 1
            FROM collections c
            WHERE c.created_by = p_user_id
            AND (
                c.id = COALESCE(p_collection_id, v_parent_collection_id)
                OR EXISTS (
                    SELECT 1
                    FROM categories cat
                    WHERE cat.collection_id = c.id
                    AND (
                        cat.id = p_category_id
                        OR EXISTS (
                            SELECT 1
                            FROM products p
                            WHERE p.category_id = cat.id
                            AND p.id = p_product_id
                        )
                    )
                )
            )
        ) INTO v_has_access;
    END IF;

    RETURN v_has_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS policies for categories to check parent collection access
CREATE OR REPLACE POLICY "categories_access_policy"
ON categories
FOR ALL
TO authenticated
USING (
    has_content_access(auth.uid(), collection_id, id, NULL, 'view')
)
WITH CHECK (
    has_content_access(auth.uid(), collection_id, id, NULL, 'edit')
);

-- Update RLS policies for products to check parent collection/category access
CREATE OR REPLACE POLICY "products_access_policy"
ON products
FOR ALL
TO authenticated
USING (
    has_content_access(auth.uid(), NULL, category_id, id, 'view')
)
WITH CHECK (
    has_content_access(auth.uid(), NULL, category_id, id, 'edit')
);

-- Create RLS policies for orders
CREATE POLICY "orders_access_policy"
ON orders
FOR ALL
TO authenticated
USING (
    -- Admin can access all orders
    (SELECT role = 'admin' FROM user_profiles WHERE user_id = auth.uid())
    OR
    -- Users can access their own orders
    user_id = auth.uid()
    OR
    -- Merchants can access orders for their products or products they have access to
    EXISTS (
        SELECT 1
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        JOIN categories c ON c.id = p.category_id
        JOIN collections col ON col.id = c.collection_id
        WHERE oi.order_id = orders.id
        AND (
            -- Merchant owns the collection
            col.created_by = auth.uid()
            OR
            -- Merchant has explicit access to the collection/category/product
            has_content_access(auth.uid(), col.id, c.id, p.id, 'view')
        )
    )
)
WITH CHECK (
    -- Only admins can create/modify orders
    (SELECT role = 'admin' FROM user_profiles WHERE user_id = auth.uid())
    OR
    -- Users can only create/modify their own orders
    user_id = auth.uid()
); 