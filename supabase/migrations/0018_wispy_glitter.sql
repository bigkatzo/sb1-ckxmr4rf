-- Drop existing constraints if they exist
DO $$ BEGIN
  ALTER TABLE products DROP CONSTRAINT IF EXISTS valid_variant_prices;
  ALTER TABLE products DROP CONSTRAINT IF EXISTS valid_variant_stock;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS validate_variant_data_trigger ON products;
DROP FUNCTION IF EXISTS validate_variant_data();

-- Add or update columns
ALTER TABLE products
ADD COLUMN IF NOT EXISTS variant_prices jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS variant_stock jsonb DEFAULT '{}'::jsonb;

-- Add check constraints
ALTER TABLE products
ADD CONSTRAINT valid_variant_prices
  CHECK (jsonb_typeof(variant_prices) = 'object'),
ADD CONSTRAINT valid_variant_stock
  CHECK (jsonb_typeof(variant_stock) = 'object');

-- Create function to validate variant data
CREATE OR REPLACE FUNCTION validate_variant_data()
RETURNS trigger AS $$
BEGIN
  -- Initialize empty objects if null
  IF NEW.variant_prices IS NULL THEN
    NEW.variant_prices := '{}'::jsonb;
  END IF;
  
  IF NEW.variant_stock IS NULL THEN
    NEW.variant_stock := '{}'::jsonb;
  END IF;

  -- Validate data types
  IF jsonb_typeof(NEW.variant_prices) != 'object' THEN
    RAISE EXCEPTION 'variant_prices must be a JSON object';
  END IF;

  IF jsonb_typeof(NEW.variant_stock) != 'object' THEN
    RAISE EXCEPTION 'variant_stock must be a JSON object';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for variant data validation
CREATE TRIGGER validate_variant_data_trigger
BEFORE INSERT OR UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION validate_variant_data();