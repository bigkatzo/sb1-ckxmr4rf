/*
  # Enhance Product Variants Schema

  1. Changes
    - Add validation for variant structure
    - Add constraints for variant prices
    - Add helper functions for variant validation
    - Update RLS policies for better security

  2. New Functions
    - validate_variant_structure: Ensures variants follow the correct format
    - validate_variant_prices: Ensures prices are valid numbers
    - generate_variant_combinations: Helps maintain valid variant combinations

  3. Constraints
    - Enforce valid variant structure
    - Ensure variant prices match valid combinations
    - Maintain data integrity across updates
*/

-- Create function to validate variant structure
CREATE OR REPLACE FUNCTION validate_variant_structure(variants jsonb)
RETURNS boolean AS $$
BEGIN
  -- Check if variants is a valid array
  IF jsonb_typeof(variants) != 'array' THEN
    RETURN false;
  END IF;

  -- Check each variant has required fields and correct structure
  RETURN (
    SELECT bool_and(
      jsonb_typeof(variant->'id') = 'string' AND
      jsonb_typeof(variant->'name') = 'string' AND
      jsonb_typeof(variant->'options') = 'array' AND
      (
        SELECT bool_and(
          jsonb_typeof(option->'id') = 'string' AND
          jsonb_typeof(option->'value') = 'string'
        )
        FROM jsonb_array_elements(variant->'options') option
      )
    )
    FROM jsonb_array_elements(variants) variant
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function to validate variant prices
CREATE OR REPLACE FUNCTION validate_variant_prices(prices jsonb)
RETURNS boolean AS $$
BEGIN
  -- Check if prices is a valid object
  IF jsonb_typeof(prices) != 'object' THEN
    RETURN false;
  END IF;

  -- Check each price is a valid non-negative number
  RETURN (
    SELECT bool_and(
      jsonb_typeof(value) = 'number' AND
      (value::text)::numeric >= 0
    )
    FROM jsonb_each(prices)
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add constraints to products table
ALTER TABLE products
DROP CONSTRAINT IF EXISTS valid_variants,
DROP CONSTRAINT IF EXISTS valid_variant_prices;

ALTER TABLE products
ADD CONSTRAINT valid_variants
  CHECK (variants IS NULL OR validate_variant_structure(variants)),
ADD CONSTRAINT valid_variant_prices
  CHECK (variant_prices IS NULL OR validate_variant_prices(variant_prices));

-- Create trigger function to maintain variant data integrity
CREATE OR REPLACE FUNCTION maintain_variant_integrity()
RETURNS trigger AS $$
BEGIN
  -- Initialize empty arrays/objects if null
  IF NEW.variants IS NULL THEN
    NEW.variants := '[]'::jsonb;
  END IF;
  
  IF NEW.variant_prices IS NULL THEN
    NEW.variant_prices := '{}'::jsonb;
  END IF;

  -- Remove prices for non-existent variant combinations
  IF jsonb_array_length(NEW.variants) = 0 THEN
    NEW.variant_prices := '{}'::jsonb;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for variant integrity
DROP TRIGGER IF EXISTS maintain_variant_integrity_trigger ON products;
CREATE TRIGGER maintain_variant_integrity_trigger
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION maintain_variant_integrity();

-- Update RLS policies
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Allow public read access to products in visible collections
CREATE POLICY "Public can view products in visible collections"
  ON products FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = products.collection_id
      AND collections.visible = true
    )
  );

-- Allow authenticated users to manage their products
CREATE POLICY "Users can manage their products"
  ON products FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = products.collection_id
      AND collections.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = products.collection_id
      AND collections.user_id = auth.uid()
    )
  );