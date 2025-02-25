-- Start transaction
BEGIN;

-- Drop the unique constraint that includes these columns
ALTER TABLE collection_access
DROP CONSTRAINT IF EXISTS unique_user_content_access;

-- Recreate the unique constraint without these columns
ALTER TABLE collection_access
ADD CONSTRAINT collection_access_user_collection_key
UNIQUE (user_id, collection_id);

-- Drop the columns
ALTER TABLE collection_access
DROP COLUMN IF EXISTS category_id,
DROP COLUMN IF EXISTS product_id;

-- Drop any orphaned indexes
DROP INDEX IF EXISTS idx_collection_access_category;
DROP INDEX IF EXISTS idx_collection_access_product;

-- Verify the columns were dropped
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'collection_access'
    AND column_name IN ('category_id', 'product_id')
  ) THEN
    RAISE EXCEPTION 'Column removal failed';
  END IF;
END $$;

COMMIT; 