/*
  # Add SKU to products
  
  1. Changes
    - Adds SKU column to products table
    - Creates SKU generation function and trigger
    - Adds constraints for SKU format and uniqueness
    
  2. Notes
    - SKU format: PRD followed by 6 digits (e.g., PRD123456)
    - Handles existing products by generating SKUs
    - Ensures uniqueness and proper formatting
*/

-- Temporarily disable the product_slug_trigger to avoid conflicts
DROP TRIGGER IF EXISTS product_slug_trigger ON products;

-- Add SKU column to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS sku text;

-- Create function to generate SKU
CREATE OR REPLACE FUNCTION generate_sku() 
RETURNS text AS $$
DECLARE
  new_sku text;
  prefix text := 'PRD';
  random_part text;
  counter int := 0;
BEGIN
  LOOP
    -- Generate random part (6 digits)
    random_part := lpad(floor(random() * 1000000)::text, 6, '0');
    new_sku := prefix || random_part;
    
    -- Check if SKU exists
    IF NOT EXISTS (SELECT 1 FROM products WHERE sku = new_sku) THEN
      RETURN new_sku;
    END IF;
    
    counter := counter + 1;
    IF counter >= 10 THEN
      -- After 10 attempts, use timestamp to ensure uniqueness
      RETURN prefix || to_char(CURRENT_TIMESTAMP, 'YYMMDDHHMMSS');
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Update existing products one at a time to avoid conflicts
DO $$ 
DECLARE
  product_record RECORD;
BEGIN
  FOR product_record IN SELECT id FROM products WHERE sku IS NULL
  LOOP
    UPDATE products 
    SET sku = generate_sku()
    WHERE id = product_record.id;
  END LOOP;
END $$;

-- Add uniqueness constraint after populating SKUs
ALTER TABLE products
ADD CONSTRAINT unique_product_sku UNIQUE (sku);

-- Add SKU format constraint after ensuring all SKUs are valid
ALTER TABLE products
ADD CONSTRAINT valid_sku CHECK (sku ~ '^PRD\d{6}$');

-- Create trigger for new products
CREATE OR REPLACE FUNCTION set_product_sku()
RETURNS trigger AS $$
BEGIN
  IF NEW.sku IS NULL THEN
    NEW.sku := generate_sku();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_sku_trigger
BEFORE INSERT ON products
FOR EACH ROW
EXECUTE FUNCTION set_product_sku();

-- Recreate the product_slug_trigger
CREATE TRIGGER product_slug_trigger
BEFORE INSERT OR UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION set_product_slug();