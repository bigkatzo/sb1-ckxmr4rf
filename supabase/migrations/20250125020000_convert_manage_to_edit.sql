-- Convert 'manage' access type to 'edit'
BEGIN;

-- Update existing records
UPDATE collection_access
SET access_type = 'edit'
WHERE access_type = 'manage';

-- Drop and recreate grant_collection_access function to ensure it only accepts 'view' or 'edit'
CREATE OR REPLACE FUNCTION grant_collection_access(
    p_user_id uuid,
    p_collection_id uuid,
    p_access_type text
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

    -- Insert or update access
    INSERT INTO collection_access (
        user_id,
        collection_id,
        access_type,
        granted_by
    )
    VALUES (
        p_user_id,
        p_collection_id,
        p_access_type,
        auth.uid()
    )
    ON CONFLICT (user_id, collection_id)
    DO UPDATE SET
        access_type = EXCLUDED.access_type,
        granted_by = EXCLUDED.granted_by,
        updated_at = now();

    -- Return success
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add a constraint to collection_access table to enforce valid access types
ALTER TABLE collection_access
ADD CONSTRAINT valid_access_type CHECK (access_type IN ('view', 'edit'));

COMMIT; 