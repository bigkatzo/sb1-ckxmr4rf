-- Add variants column to products table with proper constraints
ALTER TABLE products
ADD COLUMN IF NOT EXISTS variants jsonb DEFAULT '[]'::jsonb
CHECK (
  jsonb_typeof(variants) = 'array' AND
  (
    SELECT bool_and(
      jsonb_typeof(elem->'name') = 'string' AND
      jsonb_typeof(elem->'options') = 'array'
    )
    FROM jsonb_array_elements(variants) elem
  )
);

-- Create index for faster variant queries
CREATE INDEX IF NOT EXISTS idx_products_variants_gin
ON products USING gin(variants jsonb_path_ops);

-- Add function to validate variant structure
CREATE OR REPLACE FUNCTION validate_product_variants()
RETURNS trigger AS $$
BEGIN
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
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate variants on insert/update
CREATE TRIGGER validate_product_variants_trigger
BEFORE INSERT OR UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION validate_product_variants();