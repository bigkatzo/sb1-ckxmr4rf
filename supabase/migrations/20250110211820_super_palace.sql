-- Add tags column to collections table
ALTER TABLE collections
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Create GIN index for faster tag searches
CREATE INDEX IF NOT EXISTS idx_collections_tags
ON collections USING gin(tags);

-- Add check constraint for valid tags
ALTER TABLE collections
ADD CONSTRAINT valid_tags CHECK (
  array_position(tags, '') IS NULL AND
  array_position(tags, null) IS NULL
);