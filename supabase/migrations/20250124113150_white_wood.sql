-- Create function to sanitize filenames
CREATE OR REPLACE FUNCTION sanitize_filename(filename text)
RETURNS text AS $$
DECLARE
  file_extension text;
  base_name text;
  timestamp text;
  sanitized text;
BEGIN
  -- Extract file extension
  file_extension := COALESCE(NULLIF(regexp_replace(filename, '^.*\.', ''), filename), '');
  
  -- Get base name without extension
  base_name := CASE 
    WHEN file_extension != '' THEN regexp_replace(filename, '\.' || file_extension || '$', '')
    ELSE filename
  END;

  -- Generate timestamp
  timestamp := to_char(now(), 'YYYYMMDD_HH24MISS');

  -- Clean base name:
  -- 1. Convert to lowercase
  -- 2. Replace spaces and special chars with hyphens
  -- 3. Remove consecutive hyphens
  -- 4. Remove leading/trailing hyphens
  sanitized := regexp_replace(
    regexp_replace(
      regexp_replace(
        lower(base_name),
        '[^a-z0-9]+', '-', 'g'
      ),
      '-+', '-', 'g'
    ),
    '^-+|-+$', '', 'g'
  );

  -- Combine parts with timestamp
  RETURN CASE 
    WHEN file_extension != '' THEN 
      sanitized || '-' || timestamp || '.' || file_extension
    ELSE 
      sanitized || '-' || timestamp
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function to validate image URL
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

-- Create function to sanitize image URLs
CREATE OR REPLACE FUNCTION sanitize_image_url(url text)
RETURNS text AS $$
DECLARE
  sanitized text;
BEGIN
  -- Return null for invalid URLs
  IF NOT validate_image_url(url) THEN
    RETURN NULL;
  END IF;

  -- Extract filename from URL
  sanitized := regexp_replace(url, '^.*/([^/]+)$', '\1');
  
  -- Sanitize filename
  sanitized := sanitize_filename(sanitized);

  -- Reconstruct URL with sanitized filename
  RETURN regexp_replace(url, '[^/]+$', sanitized);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create trigger function to sanitize collection images
CREATE OR REPLACE FUNCTION sanitize_collection_images()
RETURNS trigger AS $$
BEGIN
  -- Sanitize image_url if present
  IF NEW.image_url IS NOT NULL THEN
    NEW.image_url := sanitize_image_url(NEW.image_url);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to sanitize product images
CREATE OR REPLACE FUNCTION sanitize_product_images()
RETURNS trigger AS $$
BEGIN
  -- Initialize images array if null
  IF NEW.images IS NULL THEN
    NEW.images := '{}';
  END IF;

  -- Sanitize each image URL
  NEW.images := (
    SELECT array_agg(sanitize_image_url(img))
    FROM unnest(NEW.images) img
    WHERE sanitize_image_url(img) IS NOT NULL
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for image sanitization
DROP TRIGGER IF EXISTS sanitize_collection_images_trigger ON collections;
CREATE TRIGGER sanitize_collection_images_trigger
  BEFORE INSERT OR UPDATE ON collections
  FOR EACH ROW
  EXECUTE FUNCTION sanitize_collection_images();

DROP TRIGGER IF EXISTS sanitize_product_images_trigger ON products;
CREATE TRIGGER sanitize_product_images_trigger
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION sanitize_product_images();

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
    SET image_url = sanitize_image_url(image_url)
    WHERE image_url IS NOT NULL
    RETURNING 1
  )
  SELECT count(*) INTO v_collection_count FROM updated;
  
  entity_type := 'Collections';
  fixed_count := v_collection_count;
  details := format('Sanitized %s collection images', v_collection_count);
  RETURN NEXT;

  -- Fix product images
  WITH updated AS (
    UPDATE products
    SET images = (
      SELECT array_agg(sanitize_image_url(img))
      FROM unnest(images) img
      WHERE sanitize_image_url(img) IS NOT NULL
    )
    WHERE images IS NOT NULL
    RETURNING 1
  )
  SELECT count(*) INTO v_product_count FROM updated;

  entity_type := 'Products';
  fixed_count := v_product_count;
  details := format('Sanitized %s products with images', v_product_count);
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run image fixes
SELECT * FROM fix_all_images();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION sanitize_filename(text) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_image_url(text) TO authenticated;
GRANT EXECUTE ON FUNCTION sanitize_image_url(text) TO authenticated;
GRANT EXECUTE ON FUNCTION fix_all_images() TO authenticated;