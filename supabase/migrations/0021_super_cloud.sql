-- Add slug column to products
ALTER TABLE products
ADD COLUMN IF NOT EXISTS slug text UNIQUE;

-- Add check constraint for valid slug format
ALTER TABLE products
ADD CONSTRAINT valid_product_slug 
CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

-- Function to generate slug from name
CREATE OR REPLACE FUNCTION generate_product_slug(name text) 
RETURNS text AS $$
BEGIN
  RETURN lower(regexp_replace(
    regexp_replace(name, '[^a-zA-Z0-9\s-]', '', 'g'),
    '\s+', '-', 'g'
  ));
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate slug if not provided
CREATE OR REPLACE FUNCTION set_product_slug()
RETURNS trigger AS $$
BEGIN
  IF NEW.slug IS NULL THEN
    NEW.slug := generate_product_slug(NEW.name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_slug_trigger
BEFORE INSERT OR UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION set_product_slug();