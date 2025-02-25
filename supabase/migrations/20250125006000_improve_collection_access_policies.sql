-- Start transaction
BEGIN;

-- Drop any existing collection_access policies
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'collection_access'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON collection_access', r.policyname);
    END LOOP;
END $$;

-- Enable RLS
ALTER TABLE collection_access ENABLE ROW LEVEL SECURITY;

-- Create view policy
CREATE POLICY "collection_access_view"
ON collection_access
FOR SELECT
TO authenticated
USING (
    -- Users can see their own access records
    user_id = auth.uid()
    OR
    -- Collection owners can see access records for their collections
    EXISTS (
        SELECT 1 FROM collections c
        WHERE c.id = collection_id
        AND c.user_id = auth.uid()
    )
    OR
    -- Admins can see all records
    EXISTS (
        SELECT 1 FROM user_profiles up
        WHERE up.id = auth.uid()
        AND up.role = 'admin'
    )
);

-- Create modify policy
CREATE POLICY "collection_access_modify"
ON collection_access
FOR ALL
TO authenticated
USING (
    -- Collection owners can modify access
    EXISTS (
        SELECT 1 FROM collections c
        WHERE c.id = collection_id
        AND c.user_id = auth.uid()
    )
    OR
    -- Admins can modify all records
    EXISTS (
        SELECT 1 FROM user_profiles up
        WHERE up.id = auth.uid()
        AND up.role = 'admin'
    )
);

-- Add composite index for better performance
CREATE INDEX IF NOT EXISTS idx_collection_access_collection_user 
ON collection_access(collection_id, user_id);

-- Add index for access type checks
CREATE INDEX IF NOT EXISTS idx_collection_access_type_user 
ON collection_access(access_type, user_id);

-- Enhanced verification with detailed error reporting
DO $$
DECLARE
    missing_policies text[];
    missing_indexes text[];
    tablename text;
    indexname text;
BEGIN
    -- Check for missing policies
    SELECT array_agg(t.missing_policy)
    INTO missing_policies
    FROM (
        SELECT tablename || '.' || expected_policy as missing_policy
        FROM (
            VALUES 
                ('collection_access', 'collection_access_view'),
                ('collection_access', 'collection_access_modify')
        ) as expected(tablename, expected_policy)
        WHERE NOT EXISTS (
            SELECT 1 FROM pg_policies p
            WHERE p.tablename = expected.tablename
            AND p.policyname = expected.expected_policy
        )
    ) t;

    -- Check for missing indexes
    SELECT array_agg(e.indexname)
    INTO missing_indexes
    FROM (
        VALUES 
            ('idx_collection_access_collection_user'),
            ('idx_collection_access_type_user')
    ) as e(indexname)
    WHERE NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = e.indexname
    );

    -- Raise detailed error if anything is missing
    IF missing_policies IS NOT NULL OR missing_indexes IS NOT NULL THEN
        RAISE EXCEPTION 'Migration verification failed.%s%s',
            CASE WHEN missing_policies IS NOT NULL 
                THEN E'\nMissing policies: ' || array_to_string(missing_policies, ', ')
                ELSE '' 
            END,
            CASE WHEN missing_indexes IS NOT NULL 
                THEN E'\nMissing indexes: ' || array_to_string(missing_indexes, ', ')
                ELSE '' 
            END;
    END IF;

    -- Log success
    RAISE NOTICE 'All policies and indexes successfully created';
END $$;

COMMIT; 