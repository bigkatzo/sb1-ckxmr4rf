/*
  # Add Collection Slug Field

  1. Changes
    - Add unique slug field to collections table
    - Add check constraint for valid slug format
    - Create function to generate slug from name
    - Add trigger to auto-generate slug if not provided
*/

-- Add slug column with unique constraint
ALTER TABLE collections 
ADD COLUMN IF NOT EXISTS slug text UNIQUE;

-- Add check constraint for valid slug format (lowercase, numbers, hyphens only)
ALTER TABLE collections 
ADD CONSTRAINT valid_slug CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

-- Function to generate slug from name
CREATE OR REPLACE FUNCTION generate_slug(name text) 
RETURNS text AS $$
BEGIN
  -- Convert to lowercase, replace spaces with hyphens, remove special characters
  RETURN lower(regexp_replace(
    regexp_replace(name, '[^a-zA-Z0-9\s-]', '', 'g'),
    '\s+', '-', 'g'
  ));
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate slug if not provided
CREATE OR REPLACE FUNCTION set_collection_slug()
RETURNS trigger AS $$
BEGIN
  IF NEW.slug IS NULL THEN
    NEW.slug := generate_slug(NEW.name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER collection_slug_trigger
BEFORE INSERT OR UPDATE ON collections
FOR EACH ROW
EXECUTE FUNCTION set_collection_slug();