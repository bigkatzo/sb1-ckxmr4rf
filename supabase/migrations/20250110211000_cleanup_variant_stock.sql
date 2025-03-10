-- Drop any existing triggers related to variant_stock
DROP TRIGGER IF EXISTS validate_variant_stock_trigger ON products;

-- Drop the validation function if it exists
DROP FUNCTION IF EXISTS validate_variant_stock();

-- Drop any constraints related to variant_stock
ALTER TABLE products DROP CONSTRAINT IF EXISTS valid_variant_stock;

-- Drop the variant_stock column and its index
DROP INDEX IF EXISTS idx_products_variant_stock_gin;
ALTER TABLE products DROP COLUMN IF EXISTS variant_stock;

-- Ensure the column is really gone from schema cache
NOTIFY pgrst, 'reload schema'; 