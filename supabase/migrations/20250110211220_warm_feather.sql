-- Drop existing triggers and functions first
DO $$ BEGIN
  DROP TRIGGER IF EXISTS validate_product_variants_trigger ON products;
  DROP TRIGGER IF EXISTS validate_variant_data_trigger ON products;
  DROP FUNCTION IF EXISTS validate_product_variants();
  DROP FUNCTION IF EXISTS validate_variant_data();
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create improved product validation function
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

  -- Ensure minimum_order_quantity is valid
  IF NEW.minimum_order_quantity < 1 THEN
    NEW.minimum_order_quantity := 50;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for product data validation
CREATE TRIGGER validate_product_data_trigger
BEFORE INSERT OR UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION validate_product_data();

-- Update existing products to ensure valid minimum order quantities
UPDATE products 
SET minimum_order_quantity = 50 
WHERE minimum_order_quantity < 1;