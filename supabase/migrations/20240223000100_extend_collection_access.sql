-- Modify collection_access table to support categories and products
ALTER TABLE collection_access
ADD COLUMN category_id uuid REFERENCES categories(id) ON DELETE CASCADE,
ADD COLUMN product_id uuid REFERENCES products(id) ON DELETE CASCADE;

-- Drop existing unique constraint
ALTER TABLE collection_access 
DROP CONSTRAINT collection_access_user_id_collection_id_key;

-- Add new unique constraint
ALTER TABLE collection_access
ADD CONSTRAINT unique_user_content_access 
UNIQUE (user_id, collection_id, category_id, product_id);

-- Update access_type check constraint
ALTER TABLE collection_access
DROP CONSTRAINT collection_access_access_type_check,
ADD CONSTRAINT collection_access_access_type_check 
CHECK (access_type IN ('view', 'edit'));

-- Create function to check if user has access to content
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

    -- Check if user has explicit access
    SELECT EXISTS (
        SELECT 1
        FROM collection_access ca
        WHERE ca.user_id = p_user_id
        AND (
            (p_collection_id IS NULL OR ca.collection_id = p_collection_id)
            OR (p_category_id IS NULL OR ca.category_id = p_category_id)
            OR (p_product_id IS NULL OR ca.product_id = p_product_id)
        )
        AND (
            p_required_level = 'view' 
            OR (p_required_level = 'edit' AND ca.access_type = 'edit')
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

-- Update grant_collection_access function to support categories and products
CREATE OR REPLACE FUNCTION grant_collection_access(
    p_user_id uuid,
    p_collection_id uuid DEFAULT NULL,
    p_category_id uuid DEFAULT NULL,
    p_product_id uuid DEFAULT NULL,
    p_access_type text DEFAULT 'view'
) RETURNS void AS $$
BEGIN
    -- Verify caller is admin
    IF NOT auth.is_admin() THEN
        RAISE EXCEPTION 'Only admin can grant access';
    END IF;

    -- Validate access type
    IF p_access_type NOT IN ('view', 'edit') THEN
        RAISE EXCEPTION 'Invalid access type. Must be view or edit';
    END IF;

    -- Insert or update access
    INSERT INTO collection_access (
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
        p_access_type,
        auth.uid()
    )
    ON CONFLICT (user_id, collection_id, category_id, product_id)
    DO UPDATE SET
        access_type = EXCLUDED.access_type,
        granted_by = EXCLUDED.granted_by;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update revoke_collection_access function
CREATE OR REPLACE FUNCTION revoke_collection_access(
    p_user_id uuid,
    p_collection_id uuid DEFAULT NULL,
    p_category_id uuid DEFAULT NULL,
    p_product_id uuid DEFAULT NULL
) RETURNS void AS $$
BEGIN
    -- Verify caller is admin
    IF NOT auth.is_admin() THEN
        RAISE EXCEPTION 'Only admin can revoke access';
    END IF;

    -- Delete access record
    DELETE FROM collection_access
    WHERE user_id = p_user_id
    AND collection_id IS NOT DISTINCT FROM p_collection_id
    AND category_id IS NOT DISTINCT FROM p_category_id
    AND product_id IS NOT DISTINCT FROM p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update get_user_collection_access function
CREATE OR REPLACE FUNCTION get_user_collection_access(p_user_id uuid)
RETURNS TABLE (
    content_id uuid,
    content_type text,
    content_name text,
    access_type text
) AS $$
BEGIN
    -- Verify caller is admin or user themselves
    IF NOT (auth.is_admin() OR auth.uid() = p_user_id) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    RETURN QUERY
    SELECT 
        COALESCE(ca.collection_id, ca.category_id, ca.product_id) as content_id,
        CASE
            WHEN ca.collection_id IS NOT NULL THEN 'collection'
            WHEN ca.category_id IS NOT NULL THEN 'category'
            WHEN ca.product_id IS NOT NULL THEN 'product'
        END as content_type,
        COALESCE(
            col.name,
            cat.name,
            prod.name
        ) as content_name,
        ca.access_type
    FROM collection_access ca
    LEFT JOIN collections col ON col.id = ca.collection_id
    LEFT JOIN categories cat ON cat.id = ca.category_id
    LEFT JOIN products prod ON prod.id = ca.product_id
    WHERE ca.user_id = p_user_id
    ORDER BY content_type, content_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS policies
DROP POLICY IF EXISTS "collection_access_select" ON collection_access;
DROP POLICY IF EXISTS "collection_access_all" ON collection_access;

CREATE POLICY "collection_access_select"
ON collection_access FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
    OR auth.is_admin()
    OR EXISTS (
        SELECT 1 FROM collections c
        LEFT JOIN categories cat ON cat.collection_id = c.id
        LEFT JOIN products p ON p.category_id = cat.id
        WHERE (
            c.id = collection_id
            OR cat.id = category_id
            OR p.id = product_id
        )
        AND c.created_by = auth.uid()
    )
);

CREATE POLICY "collection_access_all"
ON collection_access FOR ALL
TO authenticated
USING (auth.is_admin())
WITH CHECK (auth.is_admin()); 