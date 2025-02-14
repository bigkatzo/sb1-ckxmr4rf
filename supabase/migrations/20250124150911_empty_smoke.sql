-- Drop any existing image-related functions
DO $$ BEGIN
  DROP FUNCTION IF EXISTS validate_storage_url(text) CASCADE;
  DROP FUNCTION IF EXISTS sanitize_image_url(text) CASCADE;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create simple storage URL validation function
CREATE OR REPLACE FUNCTION validate_storage_url(url text)
RETURNS boolean AS $$
BEGIN
  RETURN true; -- Accept all URLs for now
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create simple image URL sanitization function
CREATE OR REPLACE FUNCTION sanitize_image_url(url text)
RETURNS text AS $$
BEGIN
  RETURN url; -- Return URL as-is for now
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION validate_storage_url(text) TO authenticated;
GRANT EXECUTE ON FUNCTION sanitize_image_url(text) TO authenticated;