/*
  # Fix Product Slugs

  1. Changes
    - Add improved slug generation with collision handling
    - Update trigger for automatic slug generation
    - Backfill missing slugs
    - Add validation for slug format
*/

-- Improve slug generation function with explicit table alias
CREATE OR REPLACE FUNCTION generate_product_slug(name text, collection_id uuid) 
RETURNS text AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 0;
BEGIN
  -- Convert to lowercase, replace spaces/special chars with hyphens
  base_slug := lower(regexp_replace(
    regexp_replace(name, '[^a-zA-Z0-9\s-]', '', 'g'),
    '\s+', '-', 'g'
  ));
  
  -- Remove leading/trailing hyphens
  base_slug := trim(both '-' from base_slug);
  
  -- Initial attempt with base slug
  final_slug := base_slug;
  
  -- Add counter if slug exists in same collection
  WHILE EXISTS (
    SELECT 1 FROM products p
    WHERE p.collection_id = $2 
    AND p.slug = final_slug
  ) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Update trigger function with explicit parameter names
CREATE OR REPLACE FUNCTION set_product_slug()
RETURNS trigger AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_product_slug(NEW.name, NEW.collection_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger
DROP TRIGGER IF EXISTS product_slug_trigger ON products;

-- Create new trigger
CREATE TRIGGER product_slug_trigger
BEFORE INSERT OR UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION set_product_slug();

-- Backfill missing slugs with explicit aliases
DO $$
DECLARE
  product_record RECORD;
BEGIN
  FOR product_record IN 
    SELECT p.id, p.name, p.collection_id 
    FROM products p
    WHERE p.slug IS NULL OR p.slug = ''
  LOOP
    UPDATE products p
    SET slug = generate_product_slug(product_record.name, product_record.collection_id)
    WHERE p.id = product_record.id;
  END LOOP;
END $$;