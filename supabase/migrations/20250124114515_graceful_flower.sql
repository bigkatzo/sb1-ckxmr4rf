-- Drop existing image validation functions and triggers
DO $$ BEGIN
  DROP TRIGGER IF EXISTS validate_collection_images_trigger ON collections;
  DROP TRIGGER IF EXISTS validate_product_images_trigger ON products;
  DROP FUNCTION IF EXISTS validate_collection_images() CASCADE;
  DROP FUNCTION IF EXISTS validate_product_images() CASCADE;
  DROP FUNCTION IF EXISTS validate_storage_url(text) CASCADE;
  DROP FUNCTION IF EXISTS sanitize_filename(text) CASCADE;
  DROP FUNCTION IF EXISTS sanitize_image_url(text) CASCADE;
  DROP FUNCTION IF EXISTS generate_storage_filename(text, text) CASCADE;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create simple storage URL validation function
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

  -- Allow all image URLs
  IF url ~* '\.(jpg|jpeg|png|gif|webp)([?#].*)?$' THEN
    RETURN true;
  END IF;

  -- Allow Supabase storage URLs
  IF url ~* '/storage/v1/object/public/' THEN
    RETURN true;
  END IF;

  -- Allow image hosting services
  IF url ~* '/(image|photo|media|storage)/' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create simple trigger function to validate collection images
CREATE OR REPLACE FUNCTION validate_collection_images()
RETURNS trigger AS $$
BEGIN
  -- Keep existing image_url if it's valid
  IF NEW.image_url IS NOT NULL AND NOT validate_storage_url(NEW.image_url) THEN
    NEW.image_url := OLD.image_url;
    RAISE WARNING 'Invalid collection image URL, keeping existing: %', NEW.image_url;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create simple trigger function to validate product images
CREATE OR REPLACE FUNCTION validate_product_images()
RETURNS trigger AS $$
BEGIN
  -- Keep existing valid images
  IF NEW.images IS NOT NULL THEN
    NEW.images := (
      SELECT array_agg(img)
      FROM unnest(NEW.images) img
      WHERE validate_storage_url(img)
    );
  END IF;

  -- Keep at least one image if possible
  IF array_length(NEW.images, 1) IS NULL AND array_length(OLD.images, 1) > 0 THEN
    NEW.images := OLD.images;
    RAISE WARNING 'No valid images provided, keeping existing images for product %', NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for basic image validation
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