-- Drop existing image validation functions and triggers
DO $$ BEGIN
  DROP TRIGGER IF EXISTS validate_collection_images_trigger ON collections;
  DROP TRIGGER IF EXISTS validate_product_images_trigger ON products;
  DROP FUNCTION IF EXISTS validate_collection_images() CASCADE;
  DROP FUNCTION IF EXISTS validate_product_images() CASCADE;
  DROP FUNCTION IF EXISTS validate_image_url(text) CASCADE;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create improved image URL validation function
CREATE OR REPLACE FUNCTION validate_image_url(url text)
RETURNS boolean AS $$
BEGIN
  -- Basic URL validation
  IF url IS NULL OR url = '' THEN
    RETURN false;
  END IF;

  -- Check URL format
  IF NOT (url ~* '^https?://') THEN
    RETURN false;
  END IF;

  -- Allow common image domains and patterns
  IF (
    -- Common image hosting services
    url ~* '^https?://(.*\.)?unsplash\.com/' OR
    url ~* '^https?://(.*\.)?cloudinary\.com/' OR
    url ~* '^https?://(.*\.)?supabase\.co/' OR
    url ~* '^https?://(.*\.)?githubusercontent\.com/' OR
    url ~* '^https?://(.*\.)?images\.unsplash\.com/' OR
    url ~* '^https?://(.*\.)?plus\.unsplash\.com/' OR
    url ~* '^https?://(.*\.)?raw\.githubusercontent\.com/' OR
    -- Supabase storage URLs
    url ~* '^https?://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/' OR
    url ~* '^https?://[a-z0-9-]+\.supabase\.co/storage/v1/object/sign/' OR
    -- Cloudinary URLs
    url ~* '^https?://[a-z0-9-]+\.cloudinary\.com/' OR
    -- Generic image patterns
    url ~* '/images?/' OR
    url ~* '/photos?/' OR
    url ~* '/media/' OR
    url ~* '/assets/' OR
    url ~* '/uploads?/' OR
    url ~* '/storage/' OR
    -- Image file extensions
    url ~* '\.(jpg|jpeg|png|gif|webp|avif)([?#].*)?$'
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create improved collection image validation
CREATE OR REPLACE FUNCTION validate_collection_images()
RETURNS trigger AS $$
BEGIN
  -- Validate image_url if present
  IF NEW.image_url IS NOT NULL THEN
    IF NOT validate_image_url(NEW.image_url) THEN
      -- Set to null instead of raising error
      NEW.image_url := NULL;
      RAISE WARNING 'Invalid collection image URL, setting to null: %', NEW.image_url;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create improved product image validation
CREATE OR REPLACE FUNCTION validate_product_images()
RETURNS trigger AS $$
DECLARE
  valid_images text[];
  invalid_count int := 0;
BEGIN
  -- Initialize images array if null
  IF NEW.images IS NULL THEN
    NEW.images := '{}';
  END IF;

  -- Filter and count valid/invalid images
  SELECT array_agg(img), count(*) - count(CASE WHEN validate_image_url(img) THEN 1 END)
  INTO valid_images, invalid_count
  FROM unnest(NEW.images) img;

  -- Update images array with only valid images
  NEW.images := COALESCE(valid_images, '{}');

  -- Log warning if any images were invalid
  IF invalid_count > 0 THEN
    RAISE WARNING 'Removed % invalid image(s) from product', invalid_count;
  END IF;

  -- Ensure at least one valid image
  IF array_length(NEW.images, 1) IS NULL THEN
    RAISE WARNING 'No valid images found for product, but proceeding anyway';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for image validation
CREATE TRIGGER validate_collection_images_trigger
  BEFORE INSERT OR UPDATE ON collections
  FOR EACH ROW
  EXECUTE FUNCTION validate_collection_images();

CREATE TRIGGER validate_product_images_trigger
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION validate_product_images();

-- Create function to fix existing images
CREATE OR REPLACE FUNCTION fix_all_images()
RETURNS TABLE (
  entity_type text,
  fixed_count int,
  details text
) AS $$
DECLARE
  v_collection_count int := 0;
  v_product_count int := 0;
BEGIN
  -- Fix collection images
  UPDATE collections
  SET image_url = NULL
  WHERE image_url IS NOT NULL 
  AND NOT validate_image_url(image_url);
  
  GET DIAGNOSTICS v_collection_count = ROW_COUNT;
  
  entity_type := 'Collections';
  fixed_count := v_collection_count;
  details := format('Fixed %s invalid collection images', v_collection_count);
  RETURN NEXT;

  -- Fix product images
  WITH updated AS (
    UPDATE products
    SET images = (
      SELECT array_agg(img)
      FROM unnest(images) img
      WHERE validate_image_url(img)
    )
    WHERE images IS NOT NULL
    RETURNING 1
  )
  SELECT count(*) INTO v_product_count FROM updated;

  entity_type := 'Products';
  fixed_count := v_product_count;
  details := format('Fixed %s products with invalid images', v_product_count);
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run image fixes
SELECT * FROM fix_all_images();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION validate_image_url(text) TO authenticated;
GRANT EXECUTE ON FUNCTION fix_all_images() TO authenticated;