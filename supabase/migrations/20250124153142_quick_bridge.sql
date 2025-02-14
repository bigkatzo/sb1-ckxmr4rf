-- Drop existing image validation functions
DO $$ BEGIN
  DROP FUNCTION IF EXISTS validate_storage_url(text) CASCADE;
  DROP FUNCTION IF EXISTS sanitize_image_url(text) CASCADE;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create improved storage URL validation function
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

  -- Allow Supabase storage URLs (with more permissive matching)
  IF url ~* '/storage/v1/object/(public|sign)/' THEN
    RETURN true;
  END IF;

  -- Allow common image hosting services with more permissive patterns
  IF (
    url ~* '^https?://(.*\.)?(unsplash\.com|cloudinary\.com|githubusercontent\.com|images\.unsplash\.com)/' OR
    url ~* '^https?://sakysysfksculqobozxi\.supabase\.co/' OR
    url ~* '^https?://[a-z0-9-]+\.supabase\.co/'
  ) THEN
    RETURN true;
  END IF;

  -- Allow image file extensions and paths
  IF (
    url ~* '\.(jpg|jpeg|png|gif|webp)([?#].*)?$' OR
    url ~* '/(image|photo|media|storage|assets|uploads?)/'
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create improved image URL sanitization function
CREATE OR REPLACE FUNCTION sanitize_image_url(url text)
RETURNS text AS $$
BEGIN
  -- Return null for invalid URLs
  IF NOT validate_storage_url(url) THEN
    RETURN NULL;
  END IF;

  -- For non-Supabase URLs, return as-is
  IF NOT (url ~* '/storage/v1/object/(public|sign)/') THEN
    RETURN url;
  END IF;

  -- For Supabase URLs, ensure they're properly formatted
  RETURN regexp_replace(
    url,
    '/+',
    '/',
    'g'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Fix existing collection images
UPDATE collections
SET image_url = sanitize_image_url(image_url)
WHERE image_url IS NOT NULL;

-- Fix existing product images
UPDATE products
SET images = (
  SELECT array_agg(sanitize_image_url(img))
  FROM unnest(images) img
  WHERE sanitize_image_url(img) IS NOT NULL
)
WHERE images IS NOT NULL;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION validate_storage_url(text) TO authenticated;
GRANT EXECUTE ON FUNCTION sanitize_image_url(text) TO authenticated;