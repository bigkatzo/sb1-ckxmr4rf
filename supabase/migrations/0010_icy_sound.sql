/*
  # Add featured flag to collections

  1. Changes
    - Add `featured` boolean column to collections table
    - Add index on featured column for faster queries
    - Update featured collections hook
*/

-- Add featured column
ALTER TABLE collections 
ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false;

-- Add index for faster featured queries
CREATE INDEX IF NOT EXISTS idx_collections_featured 
ON collections(featured) 
WHERE featured = true;