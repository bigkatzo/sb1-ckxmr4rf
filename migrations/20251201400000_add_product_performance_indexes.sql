-- Add additional indexes to improve product query performance
BEGIN;

-- Add index for product creation date for sorting (used in New Products tab)
CREATE INDEX IF NOT EXISTS idx_products_created_at 
ON products(created_at DESC);

-- Add composite index for visible products sorted by creation date
CREATE INDEX IF NOT EXISTS idx_products_visible_created_at 
ON products(visible, created_at DESC) 
WHERE visible = true;

-- Add index for product slug lookups (improves product page loads)
CREATE INDEX IF NOT EXISTS idx_products_slug 
ON products(slug);

-- Add index for querying products by collection with ordering
CREATE INDEX IF NOT EXISTS idx_products_collection_id_created_at
ON products(collection_id, created_at DESC);

-- Add index for products that are visible
CREATE INDEX IF NOT EXISTS idx_products_visible
ON products(visible)
WHERE visible = true;

-- Add comment to document the purpose of these indexes
COMMENT ON INDEX idx_products_created_at IS 'Improves performance for querying products ordered by creation date';
COMMENT ON INDEX idx_products_visible_created_at IS 'Speeds up querying visible products by creation date';
COMMENT ON INDEX idx_products_slug IS 'Improves product lookup by slug';
COMMENT ON INDEX idx_products_collection_id_created_at IS 'Optimizes collection product listing queries';
COMMENT ON INDEX idx_products_visible IS 'Accelerates queries for visible products';

COMMIT; 