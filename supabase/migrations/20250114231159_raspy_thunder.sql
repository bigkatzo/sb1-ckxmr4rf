-- Drop existing sale_ended column and recreate it with proper constraints
ALTER TABLE collections 
DROP COLUMN IF EXISTS sale_ended CASCADE;

-- Add sale_ended column with NOT NULL constraint and default value
ALTER TABLE collections
ADD COLUMN sale_ended boolean NOT NULL DEFAULT false;

-- Create index for faster queries
DROP INDEX IF EXISTS idx_collections_sale_ended;
CREATE INDEX idx_collections_sale_ended
ON collections(sale_ended)
WHERE sale_ended = true;

-- Create function to toggle sale ended status
CREATE OR REPLACE FUNCTION toggle_collection_sale_ended(
  p_collection_id uuid,
  p_sale_ended boolean
)
RETURNS void AS $$
BEGIN
  UPDATE collections
  SET 
    sale_ended = p_sale_ended,
    updated_at = now()
  WHERE id = p_collection_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;