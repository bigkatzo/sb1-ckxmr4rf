/*
  # Add variant indexes and constraints

  1. New Indexes
    - Add GIN indexes for variant-related columns for better query performance
  2. Constraints
    - Add check constraints for variant data validation
  3. Functions
    - Add helper functions for variant operations
*/

-- Add GIN indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_variant_prices_gin
ON products USING gin(variant_prices);

CREATE INDEX IF NOT EXISTS idx_products_variant_stock_gin
ON products USING gin(variant_stock);

-- Add check constraint for variant data structure
ALTER TABLE products
ADD CONSTRAINT valid_variant_data
CHECK (
  (variants IS NULL OR jsonb_typeof(variants) = 'array') AND
  (variant_prices IS NULL OR jsonb_typeof(variant_prices) = 'object') AND
  (variant_stock IS NULL OR jsonb_typeof(variant_stock) = 'object')
);

-- Create helper function to validate variant combination
CREATE OR REPLACE FUNCTION is_valid_variant_combination(variant_key text)
RETURNS boolean AS $$
BEGIN
  RETURN variant_key ~ '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[^|]+\|?)+$';
END;
$$ LANGUAGE plpgsql;