-- Add sale_ended column to collections
ALTER TABLE collections
ADD COLUMN IF NOT EXISTS sale_ended boolean DEFAULT false;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_collections_sale_ended
ON collections(sale_ended);

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