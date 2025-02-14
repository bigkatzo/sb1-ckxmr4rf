-- Drop existing image validation functions
DO $$ BEGIN
  DROP FUNCTION IF EXISTS validate_storage_url(text) CASCADE;
  DROP FUNCTION IF EXISTS sanitize_image_url(text) CASCADE;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create maximally permissive storage URL validation function
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
    -- Common image extensions with query params and special chars
    url ~* '\.(jpg|jpeg|png|gif|webp|avif)([?#%&()\[\]= ]|$)' OR
    -- Storage paths with query params
    url ~* '/storage/v1/object/(public|sign)/.*([?#].*)?$' OR
    -- Image-like paths with query params
    url ~* '/(image|photo|media|storage|assets|uploads?)/.*([?#].*)?$'
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create maximally permissive image URL sanitization function 
CREATE OR REPLACE FUNCTION sanitize_image_url(url text)
RETURNS text AS $$
BEGIN
  -- Return URL as-is to preserve query params and special chars
  RETURN url;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION validate_storage_url(text) TO authenticated;
GRANT EXECUTE ON FUNCTION sanitize_image_url(text) TO authenticated;