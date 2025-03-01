-- Fix function overloading issue
BEGIN;

-- Drop all versions of the function
DROP FUNCTION IF EXISTS grant_collection_access(uuid, uuid, text);
DROP FUNCTION IF EXISTS grant_collection_access(uuid, uuid, uuid, uuid, text);

-- Create unified function that handles both collection and category/product level access
CREATE OR REPLACE FUNCTION grant_collection_access(
    p_user_id uuid,
    p_collection_id uuid,
    p_access_type text,
    p_category_id uuid DEFAULT NULL,
    p_product_id uuid DEFAULT NULL
) RETURNS void AS $$
BEGIN
    -- Verify caller is admin or collection owner
    IF NOT (
        auth.is_admin() OR 
        EXISTS (
            SELECT 1 FROM collections 
            WHERE id = p_collection_id 
            AND user_id = auth.uid()
        )
    ) THEN
        RAISE EXCEPTION 'Only admin or collection owner can grant access';
    END IF;

    -- Validate access type
    IF p_access_type NOT IN ('view', 'edit') THEN
        RAISE EXCEPTION 'Invalid access type. Must be view or edit';
    END IF;

    -- Verify user exists
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
        RAISE EXCEPTION 'User does not exist';
    END IF;

    -- Verify collection exists
    IF NOT EXISTS (SELECT 1 FROM collections WHERE id = p_collection_id) THEN
        RAISE EXCEPTION 'Collection does not exist';
    END IF;

    -- Don't allow granting access to collection owner
    IF EXISTS (
        SELECT 1 FROM collections
        WHERE id = p_collection_id
        AND user_id = p_user_id
    ) THEN
        RAISE EXCEPTION 'Cannot grant access to collection owner';
    END IF;

    -- Don't allow granting access to yourself
    IF p_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Cannot grant access to yourself';
    END IF;

    -- If category_id is provided, verify it exists and belongs to the collection
    IF p_category_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM categories 
        WHERE id = p_category_id 
        AND collection_id = p_collection_id
    ) THEN
        RAISE EXCEPTION 'Category not found or does not belong to the collection';
    END IF;

    -- If product_id is provided, verify it exists and belongs to the collection
    IF p_product_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM products 
        WHERE id = p_product_id 
        AND collection_id = p_collection_id
    ) THEN
        RAISE EXCEPTION 'Product not found or does not belong to the collection';
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
    ON CONFLICT (user_id, collection_id, COALESCE(category_id, '00000000-0000-0000-0000-000000000000'), COALESCE(product_id, '00000000-0000-0000-0000-000000000000'))
    DO UPDATE SET
        access_type = EXCLUDED.access_type,
        granted_by = EXCLUDED.granted_by,
        updated_at = now();

    -- Return success
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION grant_collection_access(uuid, uuid, text, uuid, uuid) TO authenticated;

COMMIT; 