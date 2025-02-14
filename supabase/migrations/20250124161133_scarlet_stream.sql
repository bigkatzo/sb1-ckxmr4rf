-- Drop existing image validation functions
DO $$ BEGIN
  DROP FUNCTION IF EXISTS validate_storage_url(text) CASCADE;
  DROP FUNCTION IF EXISTS sanitize_image_url(text) CASCADE;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create function to validate storage URLs
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

  -- Allow all URLs from our Supabase project
  IF url ~* '^https?://sakysysfksculqobozxi\.supabase\.co/storage/v1/object/public/' THEN
    RETURN true;
  END IF;

  -- Allow all URLs that look like images or storage
  IF (
    -- Common image extensions
    url ~* '\.(jpg|jpeg|png|gif|webp|avif)$' OR
    -- Storage paths
    url ~* '/storage/v1/object/(public|sign)/' OR
    -- Image-like paths
    url ~* '/(image|photo|media|storage|assets|uploads?)/'
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
  base_url text;
  filename text;
  extension text;
  sanitized text;
  random_str text;
  timestamp text;
BEGIN
  -- Return null for invalid URLs
  IF NOT validate_storage_url(url) THEN
    RETURN NULL;
  END IF;

  -- For non-Supabase URLs, return as-is
  IF NOT (url ~* '^https?://sakysysfksculqobozxi\.supabase\.co/storage/v1/object/public/') THEN
    RETURN url;
  END IF;

  -- Remove query params and hash fragments
  base_url := regexp_replace(url, '[?#].*$', '');

  -- Extract filename
  filename := regexp_replace(base_url, '^.*/([^/]+)$', '\1');

  -- Extract extension
  extension := COALESCE(NULLIF(regexp_replace(filename, '^.*\.', ''), filename), '');

  -- Generate timestamp and random string
  timestamp := to_char(now(), 'YYYYMMDD-HH24MISS');
  random_str := encode(gen_random_bytes(4), 'hex');

  -- Clean filename:
  -- 1. Remove extension
  -- 2. Convert to lowercase
  -- 3. Replace spaces and special chars with hyphens
  -- 4. Remove consecutive hyphens
  -- 5. Remove leading/trailing hyphens
  sanitized := regexp_replace(
    regexp_replace(
      regexp_replace(
        lower(regexp_replace(filename, '\.' || extension || '$', '')),
        '[^a-z0-9]+', '-', 'g'
      ),
      '-+', '-', 'g'
    ),
    '^-+|-+$', '', 'g'
  );

  -- Add timestamp and random string
  sanitized := sanitized || '-' || timestamp || '-' || random_str;

  -- Add extension back if it exists
  IF extension != '' THEN
    sanitized := sanitized || '.' || extension;
  END IF;

  -- Replace filename in URL
  RETURN regexp_replace(base_url, '[^/]+$', sanitized);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function to fix all image URLs
CREATE OR REPLACE FUNCTION fix_all_image_urls()
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
  details := format('Fixed %s collection images', v_collection_count);
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
  details := format('Fixed %s products with images', v_product_count);
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run image fixes
SELECT * FROM fix_all_image_urls();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION validate_storage_url(text) TO authenticated;
GRANT EXECUTE ON FUNCTION sanitize_image_url(text) TO authenticated;
GRANT EXECUTE ON FUNCTION fix_all_image_urls() TO authenticated;