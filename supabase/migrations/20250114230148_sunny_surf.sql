-- Drop existing sale_ended column and recreate it with proper constraints
ALTER TABLE collections 
DROP COLUMN IF EXISTS sale_ended;

ALTER TABLE collections
ADD COLUMN sale_ended boolean NOT NULL DEFAULT false;

-- Create index for faster queries
DROP INDEX IF EXISTS idx_collections_sale_ended;
CREATE INDEX idx_collections_sale_ended
ON collections(sale_ended)
WHERE sale_ended = true;

-- Update existing collections to have sale_ended set to false
UPDATE collections 
SET sale_ended = false 
WHERE sale_ended IS NULL;

-- Ensure the column is properly exposed through RLS
DROP POLICY IF EXISTS "collections_policy" ON collections;
CREATE POLICY "collections_policy"
  ON collections
  USING (true)
  WITH CHECK (true);