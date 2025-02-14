-- Create function to validate Supabase storage URLs
CREATE OR REPLACE FUNCTION validate_storage_url(url text)
RETURNS boolean AS $$
BEGIN
  -- Basic URL validation
  IF url IS NULL OR url = '' THEN
    RETURN false;
  END IF;

  -- Check if it's a Supabase storage URL
  IF url ~* '^https?://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/(collection-images|product-images)/' THEN
    RETURN true;
  END IF;

  -- Check if it's an external image URL
  IF (
    -- Common image hosting services
    url ~* '^https?://(.*\.)?unsplash\.com/' OR
    url ~* '^https?://(.*\.)?cloudinary\.com/' OR
    url ~* '^https?://(.*\.)?githubusercontent\.com/' OR
    url ~* '^https?://(.*\.)?images\.unsplash\.com/' OR
    url ~* '^https?://(.*\.)?plus\.unsplash\.com/'
  ) AND (
    -- Valid image extensions or paths
    url ~* '\.(jpg|jpeg|png|gif|webp)([?#].*)?$' OR
    url ~* '/image/' OR
    url ~* '/photo/'
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function to generate storage filename
CREATE OR REPLACE FUNCTION generate_storage_filename(
  original_name text,
  bucket text
)
RETURNS text AS $$
DECLARE
  file_extension text;
  base_name text;
  timestamp text;
  random_str text;
BEGIN
  -- Extract file extension
  file_extension := COALESCE(NULLIF(regexp_replace(original_name, '^.*\.', ''), original_name), '');
  
  -- Get base name without extension
  base_name := CASE 
    WHEN file_extension != '' THEN regexp_replace(original_name, '\.' || file_extension || '$', '')
    ELSE original_name
  END;

  -- Generate timestamp
  timestamp := to_char(now(), 'YYYYMMDD_HH24MISS');
  
  -- Generate random string
  random_str := encode(gen_random_bytes(4), 'hex');

  -- Clean base name
  base_name := regexp_replace(
    regexp_replace(
      regexp_replace(
        lower(base_name),
        '[^a-z0-9]+', '-', 'g'
      ),
      '-+', '-', 'g'
    ),
    '^-+|-+$', '', 'g'
  );

  -- Build storage path
  RETURN format(
    '%s/%s-%s-%s.%s',
    bucket,
    base_name,
    timestamp,
    random_str,
    COALESCE(NULLIF(file_extension, ''), 'jpg')
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create trigger function to validate collection images
CREATE OR REPLACE FUNCTION validate_collection_images()
RETURNS trigger AS $$
BEGIN
  -- Validate image_url if present
  IF NEW.image_url IS NOT NULL AND NOT validate_storage_url(NEW.image_url) THEN
    RAISE WARNING 'Invalid collection image URL: %', NEW.image_url;
    NEW.image_url := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to validate product images
CREATE OR REPLACE FUNCTION validate_product_images()
RETURNS trigger AS $$
BEGIN
  -- Initialize images array if null
  IF NEW.images IS NULL THEN
    NEW.images := '{}';
  END IF;

  -- Filter valid images
  NEW.images := (
    SELECT array_agg(img)
    FROM unnest(NEW.images) img
    WHERE validate_storage_url(img)
  );

  -- Log warning if any images were filtered out
  IF array_length(NEW.images, 1) < array_length(OLD.images, 1) THEN
    RAISE WARNING 'Some invalid images were removed from product %', NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for image validation
DROP TRIGGER IF EXISTS validate_collection_images_trigger ON collections;
CREATE TRIGGER validate_collection_images_trigger
  BEFORE INSERT OR UPDATE ON collections
  FOR EACH ROW
  EXECUTE FUNCTION validate_collection_images();

DROP TRIGGER IF EXISTS validate_product_images_trigger ON products;
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
  WITH updated AS (
    UPDATE collections
    SET image_url = NULL
    WHERE image_url IS NOT NULL 
    AND NOT validate_storage_url(image_url)
    RETURNING 1
  )
  SELECT count(*) INTO v_collection_count FROM updated;
  
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
      WHERE validate_storage_url(img)
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
GRANT EXECUTE ON FUNCTION validate_storage_url(text) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_storage_filename(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION fix_all_images() TO authenticated;