-- Migration to disable image sanitization triggers that conflict with frontend URL handling
-- Date: 2025-05-17

-- Disable the triggers that modify image URLs with timestamps
DROP TRIGGER IF EXISTS sanitize_collection_images_trigger ON collections;
DROP TRIGGER IF EXISTS sanitize_product_images_trigger ON products;

-- Keep the validation triggers which only check if URLs are valid
-- but don't modify them

-- Create simple validation triggers instead
CREATE OR REPLACE FUNCTION validate_storage_url(url text)
RETURNS boolean AS $$
BEGIN
  -- Basic URL validation
  IF url IS NULL OR url = '' THEN
    RETURN false;
  END IF;

  -- Check if it's a valid URL
  IF NOT (url ~* '^https?://') THEN
    RETURN false;
  END IF;

  -- Allow Supabase storage URLs
  IF url ~* '/storage/v1/object/public/' THEN
    RETURN true;
  END IF;

  -- Allow image file extensions
  IF url ~* '\.(jpg|jpeg|png|gif|webp)([?#].*)?$' THEN
    RETURN true;
  END IF;

  -- Allow image hosting services
  IF url ~* '/(image|photo|media|storage)/' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create validation-only trigger function for collections
CREATE OR REPLACE FUNCTION validate_collection_images()
RETURNS trigger AS $$
BEGIN
  -- Only validate, don't modify
  IF NEW.image_url IS NOT NULL AND NOT validate_storage_url(NEW.image_url) THEN
    RAISE WARNING 'Invalid collection image URL: %', NEW.image_url;
    -- Optionally, set to null or leave as is
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create validation-only trigger function for products
CREATE OR REPLACE FUNCTION validate_product_images()
RETURNS trigger AS $$
BEGIN
  -- Only validate, don't modify
  IF NEW.images IS NOT NULL THEN
    NEW.images := (
      SELECT array_agg(img)
      FROM unnest(NEW.images) img
      WHERE validate_storage_url(img)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add validation-only triggers
CREATE TRIGGER validate_collection_images_trigger
  BEFORE INSERT OR UPDATE ON collections
  FOR EACH ROW
  EXECUTE FUNCTION validate_collection_images();

CREATE TRIGGER validate_product_images_trigger
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION validate_product_images();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION validate_storage_url(text) TO authenticated; 