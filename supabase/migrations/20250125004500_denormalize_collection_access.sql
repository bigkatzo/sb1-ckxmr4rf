-- Start transaction
BEGIN;

-- Drop all existing policies and functions
DROP POLICY IF EXISTS "Users can view their own collection access" ON collection_access;
DROP POLICY IF EXISTS "Collection owners can manage access" ON collection_access;
DROP POLICY IF EXISTS "Admins can manage all access" ON collection_access;
DROP POLICY IF EXISTS "Collection access view policy" ON collection_access;
DROP POLICY IF EXISTS "Collection access insert policy" ON collection_access;
DROP POLICY IF EXISTS "Collection access update policy" ON collection_access;
DROP POLICY IF EXISTS "Collection access delete policy" ON collection_access;
DROP POLICY IF EXISTS "Collection access modify policy" ON collection_access;
DROP POLICY IF EXISTS "Collection access basic policy" ON collection_access;
DROP POLICY IF EXISTS "Users view own access" ON collection_access;

DROP MATERIALIZED VIEW IF EXISTS collection_ownership;
DROP FUNCTION IF EXISTS refresh_collection_ownership() CASCADE;
DROP FUNCTION IF EXISTS is_admin() CASCADE;
DROP FUNCTION IF EXISTS is_collection_owner(uuid) CASCADE;

-- Add collection_owner_id column
ALTER TABLE collection_access ADD COLUMN IF NOT EXISTS collection_owner_id UUID REFERENCES auth.users(id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_collection_access_owner ON collection_access(collection_owner_id);

-- Update existing records with owner information
UPDATE collection_access ca
SET collection_owner_id = c.user_id
FROM collections c
WHERE ca.collection_id = c.id;

-- Make collection_owner_id NOT NULL after populating data
ALTER TABLE collection_access ALTER COLUMN collection_owner_id SET NOT NULL;

-- Create trigger function to maintain collection_owner_id
CREATE OR REPLACE FUNCTION maintain_collection_owner_id()
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
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically set collection_owner_id
DROP TRIGGER IF EXISTS set_collection_owner_trigger ON collection_access;
CREATE TRIGGER set_collection_owner_trigger
    BEFORE INSERT OR UPDATE OF collection_id
    ON collection_access
    FOR EACH ROW
    EXECUTE FUNCTION maintain_collection_owner_id();

-- Enable RLS
ALTER TABLE collection_access ENABLE ROW LEVEL SECURITY;

-- Create simple policy based on denormalized data
CREATE POLICY "collection_access_policy"
ON collection_access
FOR ALL
TO authenticated
USING (
    -- User can access their own records
    user_id = auth.uid()
    OR
    -- Collection owners can access records for their collections
    collection_owner_id = auth.uid()
    OR
    -- Admins can access all records
    EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid()
        AND role = 'admin'
    )
);

-- Verify everything is set up correctly
DO $$
BEGIN
    -- Check if column exists
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'collection_access'
        AND column_name = 'collection_owner_id'
    ) THEN
        RAISE EXCEPTION 'collection_owner_id column not found';
    END IF;

    -- Check if trigger exists
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'set_collection_owner_trigger'
    ) THEN
        RAISE EXCEPTION 'Trigger not created properly';
    END IF;

    -- Check if policy exists
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE tablename = 'collection_access'
        AND policyname = 'collection_access_policy'
    ) THEN
        RAISE EXCEPTION 'Policy not created properly';
    END IF;
END $$;

COMMIT; 