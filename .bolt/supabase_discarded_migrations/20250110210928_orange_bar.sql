-- Drop existing constraints, triggers and functions
DO $$ BEGIN
  -- Drop constraints
  ALTER TABLE products DROP CONSTRAINT IF EXISTS minimum_order_quantity_check;
  ALTER TABLE products DROP CONSTRAINT IF EXISTS valid_variant_prices;
  
  -- Drop triggers
  DROP TRIGGER IF EXISTS validate_variant_prices_trigger ON products;
  DROP TRIGGER IF EXISTS validate_product_variants_trigger ON products;
  DROP TRIGGER IF EXISTS validate_variant_data_trigger ON products;
  
  -- Drop functions
  DROP FUNCTION IF EXISTS validate_variant_prices();
  DROP FUNCTION IF EXISTS validate_product_variants();
  DROP FUNCTION IF EXISTS validate_variant_data();
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Drop variant_stock column if it exists
ALTER TABLE products DROP COLUMN IF EXISTS variant_stock;

-- Ensure minimum_order_quantity has correct settings
ALTER TABLE products 
ALTER COLUMN minimum_order_quantity SET DEFAULT 50;

ALTER TABLE products 
ALTER COLUMN minimum_order_quantity SET NOT NULL;

-- Add minimum_order_quantity constraint
ALTER TABLE products
ADD CONSTRAINT minimum_order_quantity_check CHECK (minimum_order_quantity >= 1);

-- Add variant_prices constraint
ALTER TABLE products
ADD CONSTRAINT valid_variant_prices CHECK (
  variant_prices IS NULL OR 
  jsonb_typeof(variant_prices) = 'object'
);

-- Create improved variant validation function
CREATE OR REPLACE FUNCTION validate_product_data()
RETURNS trigger AS $$
BEGIN
  -- Initialize empty objects if null
  IF NEW.variant_prices IS NULL THEN
    NEW.variant_prices := '{}'::jsonb;
  END IF;

  -- Validate variants structure
  IF NEW.variants IS NOT NULL THEN
    IF NOT (
      SELECT bool_and(
        jsonb_typeof(elem->'id') = 'string' AND
        jsonb_typeof(elem->'name') = 'string' AND
        jsonb_typeof(elem->'options') = 'array' AND
        (
          SELECT bool_and(
            jsonb_typeof(opt->'id') = 'string' AND
            jsonb_typeof(opt->'value') = 'string'
          )
          FROM jsonb_array_elements(elem->'options') opt
        )
      )
      FROM jsonb_array_elements(NEW.variants) elem
    ) THEN
      RAISE EXCEPTION 'Invalid variant structure';
    END IF;
  END IF;

  -- Validate variant prices
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

-- Create trigger for data validation
CREATE TRIGGER validate_product_data_trigger
BEFORE INSERT OR UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION validate_product_data();

-- Update existing products
UPDATE products 
SET 
  minimum_order_quantity = GREATEST(50, minimum_order_quantity),
  variant_prices = COALESCE(variant_prices, '{}'::jsonb),
  variants = COALESCE(variants, '[]'::jsonb);