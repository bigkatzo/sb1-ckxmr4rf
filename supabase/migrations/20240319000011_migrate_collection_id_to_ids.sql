-- Start transaction
BEGIN;

-- Migrate existing collection_id values to collection_ids array
UPDATE coupons
SET collection_ids = ARRAY[collection_id]
WHERE collection_id IS NOT NULL
  AND (collection_ids IS NULL OR array_length(collection_ids, 1) IS NULL);

-- Drop the old collection_id column
ALTER TABLE coupons
DROP COLUMN IF EXISTS collection_id;

COMMIT; 