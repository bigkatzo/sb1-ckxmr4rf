-- Drop existing constraints if they exist
DO $$ BEGIN
  ALTER TABLE products DROP CONSTRAINT IF EXISTS minimum_order_quantity_check;
  ALTER TABLE products DROP CONSTRAINT IF EXISTS valid_variant_prices;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS validate_variant_prices_trigger ON products;
DROP FUNCTION IF EXISTS validate_variant_prices();

-- Drop variant_stock column if it exists
ALTER TABLE products DROP COLUMN IF EXISTS variant_stock;

-- Ensure minimum_order_quantity has correct default and constraints
ALTER TABLE products 
ALTER COLUMN minimum_order_quantity SET DEFAULT 50;

ALTER TABLE products 
ALTER COLUMN minimum_order_quantity SET NOT NULL;

-- Add constraint after dropping existing one
ALTER TABLE products
ADD CONSTRAINT minimum_order_quantity_check CHECK (minimum_order_quantity >= 1);

-- Add variant_prices constraint
ALTER TABLE products
ADD CONSTRAINT valid_variant_prices CHECK (
  variant_prices IS NULL OR 
  jsonb_typeof(variant_prices) = 'object'
);

-- Create function to validate variant prices
CREATE OR REPLACE FUNCTION validate_variant_prices()
RETURNS trigger AS $$
BEGIN
  IF NEW.variant_prices IS NOT NULL THEN
    IF NOT (
      SELECT bool_and(
        jsonb_typeof(value) = 'number' AND 
        (value::text)::numeric >= 0
      )
      FROM jsonb_each(NEW.variant_prices)
    ) THEN
      RAISE EXCEPTION 'All variant prices must be non-negative numbers';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for variant price validation
CREATE TRIGGER validate_variant_prices_trigger
BEFORE INSERT OR UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION validate_variant_prices();

-- Update any existing products
UPDATE products 
SET minimum_order_quantity = 50 
WHERE minimum_order_quantity < 1;