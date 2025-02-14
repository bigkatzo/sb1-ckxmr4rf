-- Drop any existing image-related functions
DO $$ BEGIN
  DROP FUNCTION IF EXISTS validate_storage_url(text) CASCADE;
  DROP FUNCTION IF EXISTS sanitize_image_url(text) CASCADE;
  DROP TRIGGER IF EXISTS validate_collection_images_trigger ON collections;
  DROP TRIGGER IF EXISTS validate_product_images_trigger ON products;
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
  RETURN true;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create simple image URL sanitization function
CREATE OR REPLACE FUNCTION sanitize_image_url(url text)
RETURNS text AS $$
BEGIN
  -- Return URL as-is
  RETURN url;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION validate_storage_url(text) TO authenticated;
GRANT EXECUTE ON FUNCTION sanitize_image_url(text) TO authenticated;