-- Start transaction
BEGIN;

-- First, update existing records where granted_by is null
UPDATE collection_access ca
SET granted_by = collection_owner_id
WHERE granted_by IS NULL;

-- Add NOT NULL constraint
ALTER TABLE collection_access
ALTER COLUMN granted_by SET NOT NULL;

-- Create or replace the trigger function to ensure granted_by is set
CREATE OR REPLACE FUNCTION maintain_collection_access_metadata()
RETURNS TRIGGER AS $$
DECLARE
    owner_id UUID;
BEGIN
    -- Get the collection owner's ID
    SELECT user_id INTO owner_id
    FROM collections
    WHERE id = NEW.collection_id;

    IF owner_id IS NULL THEN
        RAISE EXCEPTION 'Collection not found or has no owner';
    END IF;

    -- Set the owner ID
    NEW.collection_owner_id := owner_id;
    
    -- Set granted_by to the current user if provided, otherwise use the owner
    IF NEW.granted_by IS NULL THEN
        BEGIN
            NEW.granted_by := auth.uid();
        EXCEPTION WHEN OTHERS THEN
            -- If auth.uid() fails, use the collection owner
            NEW.granted_by := owner_id;
        END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop old trigger and create new one
DROP TRIGGER IF EXISTS set_collection_owner_trigger ON collection_access;
CREATE TRIGGER maintain_collection_access_metadata_trigger
    BEFORE INSERT OR UPDATE
    ON collection_access
    FOR EACH ROW
    EXECUTE FUNCTION maintain_collection_access_metadata();

-- Verify the changes
DO $$
BEGIN
    -- Check if there are any null granted_by values
    IF EXISTS (
        SELECT 1
        FROM collection_access
        WHERE granted_by IS NULL
    ) THEN
        RAISE EXCEPTION 'Found null granted_by values after migration';
    END IF;

    -- Check if trigger exists
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'maintain_collection_access_metadata_trigger'
    ) THEN
        RAISE EXCEPTION 'Trigger not created properly';
    END IF;
END $$;

COMMIT; 