-- Add sale_ended column to collections if it doesn't exist
ALTER TABLE collections
ADD COLUMN IF NOT EXISTS sale_ended boolean DEFAULT false;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_collections_sale_ended
ON collections(sale_ended)
WHERE sale_ended = true;

-- Update collection view policy to include sale_ended
DROP POLICY IF EXISTS "collections_policy" ON collections;
CREATE POLICY "collections_policy"
  ON collections
  USING (
    visible = true 
    OR auth.uid() = user_id
    OR auth.is_admin()
  )
  WITH CHECK (
    auth.uid() = user_id
    OR auth.is_admin()
  );

-- Update existing collections to have sale_ended set to false
UPDATE collections 
SET sale_ended = false 
WHERE sale_ended IS NULL;