/*
  # Add variant pricing and stock tracking

  1. Changes
    - Add variant_prices and variant_stock columns to products table
    - Add validation for variant prices and stock
    - Update existing triggers

  2. Security
    - Maintain existing RLS policies
*/

-- Add variant pricing and stock columns
ALTER TABLE products
ADD COLUMN IF NOT EXISTS variant_prices jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS variant_stock jsonb DEFAULT '{}'::jsonb;

-- Add check constraints
ALTER TABLE products
ADD CONSTRAINT valid_variant_prices
  CHECK (jsonb_typeof(variant_prices) = 'object'),
ADD CONSTRAINT valid_variant_stock
  CHECK (jsonb_typeof(variant_stock) = 'object');

-- Update variant validation function
CREATE OR REPLACE FUNCTION validate_product_variants()
RETURNS trigger AS $$
BEGIN
  -- Validate variant structure
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

  -- Initialize variant prices and stock if not set
  IF NEW.variant_prices IS NULL THEN
    NEW.variant_prices = '{}'::jsonb;
  END IF;
  
  IF NEW.variant_stock IS NULL THEN
    NEW.variant_stock = '{}'::jsonb;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;