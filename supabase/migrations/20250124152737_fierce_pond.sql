-- Drop any existing image-related functions
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

  -- Allow Supabase storage URLs
  IF url ~* '/storage/v1/object/public/(collection-images|product-images)/' THEN
    RETURN true;
  END IF;

  -- Allow common image hosting services
  IF url ~* '^https?://(.*\.)?(unsplash\.com|cloudinary\.com|githubusercontent\.com)/' THEN
    RETURN true;
  END IF;

  -- Allow image file extensions
  IF url ~* '\.(jpg|jpeg|png|gif|webp)([?#].*)?$' THEN
    RETURN true;
  END IF;

  -- Allow image-like paths
  IF url ~* '/(image|photo|media|storage)/' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function to sanitize image URLs
CREATE OR REPLACE FUNCTION sanitize_image_url(url text)
RETURNS text AS $$
DECLARE
  path_parts text[];
  filename text;
  extension text;
  sanitized text;
BEGIN
  -- Return null for invalid URLs
  IF NOT validate_storage_url(url) THEN
    RETURN NULL;
  END IF;

  -- For non-Supabase URLs, return as-is
  IF NOT (url ~* '/storage/v1/object/public/(collection-images|product-images)/') THEN
    RETURN url;
  END IF;

  -- Extract filename from URL
  path_parts := regexp_split_to_array(url, '/');
  filename := path_parts[array_length(path_parts, 1)];

  -- Extract extension
  extension := COALESCE(NULLIF(regexp_replace(filename, '^.*\.', ''), filename), '');
  
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

  -- Add timestamp to prevent collisions
  sanitized := sanitized || '-' || to_char(now(), 'YYYYMMDD-HH24MISS');

  -- Add extension back if it exists
  IF extension != '' THEN
    sanitized := sanitized || '.' || extension;
  END IF;

  -- Replace filename in URL
  RETURN regexp_replace(url, '[^/]+$', sanitized);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION validate_storage_url(text) TO authenticated;
GRANT EXECUTE ON FUNCTION sanitize_image_url(text) TO authenticated;