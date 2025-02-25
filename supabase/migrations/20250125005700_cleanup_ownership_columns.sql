-- Start transaction
BEGIN;

-- Drop owner-related columns from collections table
ALTER TABLE collections
DROP COLUMN IF EXISTS owner CASCADE,
DROP COLUMN IF EXISTS owner_id CASCADE;

-- Update collection_access to not use 'owner' access_type
UPDATE collection_access
SET access_type = 'edit'
WHERE access_type = 'owner';

-- Add check constraint to prevent 'owner' access_type
ALTER TABLE collection_access
DROP CONSTRAINT IF EXISTS valid_access_types,
ADD CONSTRAINT valid_access_types 
  CHECK (access_type IN ('view', 'edit'));

-- Verify changes
DO $$
BEGIN
  -- Check if columns were dropped
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'collections'
    AND column_name IN ('owner', 'owner_id')
  ) THEN
    RAISE EXCEPTION 'Failed to drop owner columns';
  END IF;

  -- Check if any 'owner' access types remain
  IF EXISTS (
    SELECT 1
    FROM collection_access
    WHERE access_type = 'owner'
  ) THEN
    RAISE EXCEPTION 'Failed to update owner access types';
  END IF;

  -- Check if constraint exists
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.constraint_column_usage
    WHERE table_name = 'collection_access'
    AND constraint_name = 'valid_access_types'
  ) THEN
    RAISE EXCEPTION 'Failed to create access type constraint';
  END IF;
END $$;

COMMIT; 