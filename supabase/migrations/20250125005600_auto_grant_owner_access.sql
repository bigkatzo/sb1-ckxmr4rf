-- Start transaction
BEGIN;

-- Create function to grant owner access
CREATE OR REPLACE FUNCTION grant_owner_collection_access()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert access record for the owner
    INSERT INTO collection_access (
        collection_id,
        user_id,
        access_type,
        granted_by,
        collection_owner_id
    ) VALUES (
        NEW.id,        -- collection_id
        NEW.user_id,   -- user_id
        'edit',        -- access_type
        NEW.user_id,   -- granted_by (owner grants themselves access)
        NEW.user_id    -- collection_owner_id
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically grant access when collection is created
DROP TRIGGER IF EXISTS auto_grant_owner_access ON collections;
CREATE TRIGGER auto_grant_owner_access
    AFTER INSERT ON collections
    FOR EACH ROW
    EXECUTE FUNCTION grant_owner_collection_access();

-- Verify existing collections have owner access
INSERT INTO collection_access (
    collection_id,
    user_id,
    access_type,
    granted_by,
    collection_owner_id
)
SELECT 
    c.id,
    c.user_id,
    'edit',
    c.user_id,
    c.user_id
FROM collections c
WHERE NOT EXISTS (
    SELECT 1 
    FROM collection_access ca 
    WHERE ca.collection_id = c.id 
    AND ca.user_id = c.user_id
);

-- Verify the changes
DO $$
BEGIN
    -- Check if trigger exists
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'auto_grant_owner_access'
    ) THEN
        RAISE EXCEPTION 'Trigger not created properly';
    END IF;

    -- Check if all collection owners have edit access
    IF EXISTS (
        SELECT 1
        FROM collections c
        LEFT JOIN collection_access ca ON 
            ca.collection_id = c.id AND 
            ca.user_id = c.user_id AND 
            ca.access_type = 'edit'
        WHERE ca.id IS NULL
    ) THEN
        RAISE EXCEPTION 'Found collections where owner does not have edit access';
    END IF;
END $$;

COMMIT; 