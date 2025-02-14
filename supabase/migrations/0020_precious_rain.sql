/*
  # Add variant columns and constraints

  1. New Columns
    - Add variant_options column for storing variant options
    - Add variant_combinations column for storing valid combinations
  2. Constraints
    - Add check constraints for variant data validation
  3. Indexes
    - Add GIN indexes for better query performance
*/

-- Add variant options column
ALTER TABLE products
ADD COLUMN IF NOT EXISTS variant_options jsonb DEFAULT '[]'::jsonb;

-- Add variant combinations column
ALTER TABLE products
ADD COLUMN IF NOT EXISTS variant_combinations jsonb DEFAULT '[]'::jsonb;

-- Add GIN indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_variant_options_gin
ON products USING gin(variant_options);

CREATE INDEX IF NOT EXISTS idx_products_variant_combinations_gin
ON products USING gin(variant_combinations);

-- Add check constraints
ALTER TABLE products
ADD CONSTRAINT valid_variant_options
CHECK (jsonb_typeof(variant_options) = 'array'),
ADD CONSTRAINT valid_variant_combinations
CHECK (jsonb_typeof(variant_combinations) = 'array');