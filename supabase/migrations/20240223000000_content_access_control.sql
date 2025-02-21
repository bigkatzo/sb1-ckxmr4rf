-- Create enum for access levels
CREATE TYPE access_level AS ENUM ('view', 'edit');

-- Create table for content access control
CREATE TABLE content_access (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    collection_id uuid REFERENCES collections(id) ON DELETE CASCADE,
    category_id uuid REFERENCES categories(id) ON DELETE CASCADE,
    product_id uuid REFERENCES products(id) ON DELETE CASCADE,
    access_level access_level NOT NULL,
    granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    granted_at timestamptz DEFAULT now(),
    CONSTRAINT unique_user_content_access UNIQUE (user_id, collection_id, category_id, product_id)
);

-- Create view for user roles
CREATE VIEW user_roles AS
SELECT 
    u.id as user_id,
    up.role,
    CASE 
        WHEN up.role = 'admin' THEN true
        ELSE false
    END as is_admin,
    CASE 
        WHEN up.role = 'merchant' THEN true
        ELSE false
    END as is_merchant
FROM auth.users u
LEFT JOIN user_profiles up ON u.id = up.user_id;

-- Create function to check if user has access to content
CREATE OR REPLACE FUNCTION has_content_access(
    p_user_id uuid,
    p_collection_id uuid DEFAULT NULL,
    p_category_id uuid DEFAULT NULL,
    p_product_id uuid DEFAULT NULL,
    p_required_level access_level DEFAULT 'view'
) RETURNS boolean AS $$
DECLARE
    v_is_admin boolean;
    v_is_merchant boolean;
    v_has_access boolean;
BEGIN
    -- Get user role information
    SELECT is_admin, is_merchant INTO v_is_admin, v_is_merchant
    FROM user_roles
    WHERE user_id = p_user_id;

    -- Admins always have access
    IF v_is_admin THEN
        RETURN true;
    END IF;

    -- Check if user has explicit access
    SELECT EXISTS (
        SELECT 1
        FROM content_access ca
        WHERE ca.user_id = p_user_id
        AND (
            (p_collection_id IS NULL OR ca.collection_id = p_collection_id)
            OR (p_category_id IS NULL OR ca.category_id = p_category_id)
            OR (p_product_id IS NULL OR ca.product_id = p_product_id)
        )
        AND (
            p_required_level = 'view' 
            OR (p_required_level = 'edit' AND ca.access_level = 'edit')
        )
    ) INTO v_has_access;

    -- If user is a merchant, check if they own the content
    IF v_is_merchant AND NOT v_has_access THEN
        SELECT EXISTS (
            SELECT 1
            FROM collections c
            LEFT JOIN categories cat ON cat.collection_id = c.id
            LEFT JOIN products p ON p.category_id = cat.id
            WHERE c.created_by = p_user_id
            AND (
                (p_collection_id IS NULL OR c.id = p_collection_id)
                OR (p_category_id IS NULL OR cat.id = p_category_id)
                OR (p_product_id IS NULL OR p.id = p_product_id)
            )
        ) INTO v_has_access;
    END IF;

    RETURN v_has_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RLS policies for collections
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow admins full access to collections"
ON collections
FOR ALL
TO authenticated
USING (
    (SELECT is_admin FROM user_roles WHERE user_id = auth.uid())
)
WITH CHECK (
    (SELECT is_admin FROM user_roles WHERE user_id = auth.uid())
);

CREATE POLICY "Allow merchants to manage their own collections"
ON collections
FOR ALL
TO authenticated
USING (
    created_by = auth.uid()
    AND (SELECT is_merchant FROM user_roles WHERE user_id = auth.uid())
)
WITH CHECK (
    created_by = auth.uid()
    AND (SELECT is_merchant FROM user_roles WHERE user_id = auth.uid())
);

CREATE POLICY "Allow users with explicit access to view/edit collections"
ON collections
FOR ALL
TO authenticated
USING (
    has_content_access(auth.uid(), id, NULL, NULL, 'view')
)
WITH CHECK (
    has_content_access(auth.uid(), id, NULL, NULL, 'edit')
);

-- Create similar policies for categories and products
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Categories policies
CREATE POLICY "Allow admins full access to categories"
ON categories
FOR ALL
TO authenticated
USING (
    (SELECT is_admin FROM user_roles WHERE user_id = auth.uid())
)
WITH CHECK (
    (SELECT is_admin FROM user_roles WHERE user_id = auth.uid())
);

CREATE POLICY "Allow merchants to manage their own categories"
ON categories
FOR ALL
TO authenticated
USING (
    collection_id IN (SELECT id FROM collections WHERE created_by = auth.uid())
    AND (SELECT is_merchant FROM user_roles WHERE user_id = auth.uid())
)
WITH CHECK (
    collection_id IN (SELECT id FROM collections WHERE created_by = auth.uid())
    AND (SELECT is_merchant FROM user_roles WHERE user_id = auth.uid())
);

CREATE POLICY "Allow users with explicit access to view/edit categories"
ON categories
FOR ALL
TO authenticated
USING (
    has_content_access(auth.uid(), NULL, id, NULL, 'view')
)
WITH CHECK (
    has_content_access(auth.uid(), NULL, id, NULL, 'edit')
);

-- Products policies
CREATE POLICY "Allow admins full access to products"
ON products
FOR ALL
TO authenticated
USING (
    (SELECT is_admin FROM user_roles WHERE user_id = auth.uid())
)
WITH CHECK (
    (SELECT is_admin FROM user_roles WHERE user_id = auth.uid())
);

CREATE POLICY "Allow merchants to manage their own products"
ON products
FOR ALL
TO authenticated
USING (
    category_id IN (
        SELECT c.id 
        FROM categories c
        JOIN collections col ON c.collection_id = col.id
        WHERE col.created_by = auth.uid()
    )
    AND (SELECT is_merchant FROM user_roles WHERE user_id = auth.uid())
)
WITH CHECK (
    category_id IN (
        SELECT c.id 
        FROM categories c
        JOIN collections col ON c.collection_id = col.id
        WHERE col.created_by = auth.uid()
    )
    AND (SELECT is_merchant FROM user_roles WHERE user_id = auth.uid())
);

CREATE POLICY "Allow users with explicit access to view/edit products"
ON products
FOR ALL
TO authenticated
USING (
    has_content_access(auth.uid(), NULL, NULL, id, 'view')
)
WITH CHECK (
    has_content_access(auth.uid(), NULL, NULL, id, 'edit')
);

-- Create RLS policies for content_access table
ALTER TABLE content_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow admins to manage all content access"
ON content_access
FOR ALL
TO authenticated
USING (
    (SELECT is_admin FROM user_roles WHERE user_id = auth.uid())
)
WITH CHECK (
    (SELECT is_admin FROM user_roles WHERE user_id = auth.uid())
);

CREATE POLICY "Allow users to view their own access"
ON content_access
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
);

-- Create functions for managing access
CREATE OR REPLACE FUNCTION grant_content_access(
    p_user_id uuid,
    p_collection_id uuid DEFAULT NULL,
    p_category_id uuid DEFAULT NULL,
    p_product_id uuid DEFAULT NULL,
    p_access_level access_level DEFAULT 'view'
) RETURNS void AS $$
BEGIN
    -- Check if caller is admin
    IF NOT (SELECT is_admin FROM user_roles WHERE user_id = auth.uid()) THEN
        RAISE EXCEPTION 'Only administrators can grant access';
    END IF;

    -- Insert or update access
    INSERT INTO content_access (
        user_id,
        collection_id,
        category_id,
        product_id,
        access_level,
        granted_by
    )
    VALUES (
        p_user_id,
        p_collection_id,
        p_category_id,
        p_product_id,
        p_access_level,
        auth.uid()
    )
    ON CONFLICT (user_id, collection_id, category_id, product_id)
    DO UPDATE SET
        access_level = p_access_level,
        granted_by = auth.uid(),
        granted_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION revoke_content_access(
    p_user_id uuid,
    p_collection_id uuid DEFAULT NULL,
    p_category_id uuid DEFAULT NULL,
    p_product_id uuid DEFAULT NULL
) RETURNS void AS $$
BEGIN
    -- Check if caller is admin
    IF NOT (SELECT is_admin FROM user_roles WHERE user_id = auth.uid()) THEN
        RAISE EXCEPTION 'Only administrators can revoke access';
    END IF;

    -- Delete access record
    DELETE FROM content_access
    WHERE user_id = p_user_id
    AND collection_id IS NOT DISTINCT FROM p_collection_id
    AND category_id IS NOT DISTINCT FROM p_category_id
    AND product_id IS NOT DISTINCT FROM p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 