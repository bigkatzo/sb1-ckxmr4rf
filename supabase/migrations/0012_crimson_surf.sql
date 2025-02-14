-- Add visibility column with default true
ALTER TABLE collections 
ADD COLUMN IF NOT EXISTS visible BOOLEAN DEFAULT true;

-- Add index for faster visibility queries
CREATE INDEX IF NOT EXISTS idx_collections_visible 
ON collections(visible);