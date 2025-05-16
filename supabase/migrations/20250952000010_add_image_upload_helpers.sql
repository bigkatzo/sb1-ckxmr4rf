/*
  # Add Image Upload Helper Functions
  
  This migration adds helper functions to handle image uploads properly:
  1. Adds a function to validate and fix image mime types
  2. Adds a function to generate unique filenames
  3. Adds a function to check storage access
  4. Provides better error handling for uploads
*/

BEGIN;

-- Create a function to validate and detect image mime types
CREATE OR REPLACE FUNCTION public.validate_image_mime_type(filename text)
RETURNS text AS $$
DECLARE
  extension text;
  mime_type text;
BEGIN
  -- Extract file extension
  extension := lower(substring(filename from '\.([^\.]+)$'));
  
  -- Map to proper mime type
  CASE extension
    WHEN 'jpg' THEN mime_type := 'image/jpeg';
    WHEN 'jpeg' THEN mime_type := 'image/jpeg';
    WHEN 'png' THEN mime_type := 'image/png';
    WHEN 'gif' THEN mime_type := 'image/gif';
    WHEN 'webp' THEN mime_type := 'image/webp';
    WHEN 'svg' THEN mime_type := 'image/svg+xml';
    WHEN 'avif' THEN mime_type := 'image/avif';
    ELSE mime_type := 'application/octet-stream';
  END CASE;
  
  RETURN mime_type;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create an improved function to generate completely safe unique filenames
CREATE OR REPLACE FUNCTION public.generate_unique_filename(
  original_filename text DEFAULT NULL,
  entity_type text DEFAULT 'image'
) 
RETURNS text AS $$
DECLARE
  extension text;
  filename_base text;
  timestamp_part text;
  random_part text;
  final_name text;
BEGIN
  -- Get only the extension from the original filename if provided
  IF original_filename IS NOT NULL THEN
    extension := lower(substring(original_filename from '\.([^\.]+)$'));
  END IF;
  
  -- Default extension if none found
  IF extension IS NULL OR extension = '' THEN
    extension := 'jpg';
  END IF;
  
  -- Only allow specific safe extensions
  IF extension NOT IN ('jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif') THEN
    extension := 'jpg';  -- Default to jpg for safety
  END IF;
  
  -- Generate timestamp (format: YYYYMMDDHHMMSS)
  timestamp_part := to_char(now(), 'YYYYMMDDHHMI24SS');
  
  -- Generate 12 characters of hex for increased uniqueness
  random_part := lower(encode(gen_random_bytes(6), 'hex'));
  
  -- Build filename using only safe characters (alphanumeric and dash)
  final_name := timestamp_part || '-' || random_part || '.' || extension;
  
  -- Additional safety check - remove any potentially problematic characters
  final_name := regexp_replace(final_name, '[^a-z0-9\.\-]', '', 'g');
  
  RETURN final_name;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Create a function to diagnose storage upload issues
CREATE OR REPLACE FUNCTION public.diagnose_storage_upload(
  bucket_id text,
  filename text DEFAULT NULL,
  content_type text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  bucket_info record;
  policy_info jsonb;
  real_content_type text;
  role_name text;
  result jsonb;
BEGIN
  -- Get current role
  SELECT current_user INTO role_name;
  
  -- Get bucket information
  SELECT * INTO bucket_info
  FROM storage.buckets
  WHERE id = bucket_id;
  
  -- Get real content type
  IF content_type IS NULL AND filename IS NOT NULL THEN
    real_content_type := public.validate_image_mime_type(filename);
  ELSE
    real_content_type := content_type;
  END IF;
  
  -- Get policy information
  SELECT jsonb_agg(jsonb_build_object(
    'policy_name', policyname,
    'command', cmd,
    'roles', roles
  ))
  INTO policy_info
  FROM pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects';
  
  -- Build result
  result := jsonb_build_object(
    'timestamp', now(),
    'role', role_name,
    'bucket_exists', bucket_info IS NOT NULL,
    'bucket_public', CASE WHEN bucket_info IS NULL THEN NULL ELSE bucket_info.public END,
    'mime_type_restrictions', CASE WHEN bucket_info IS NULL THEN NULL ELSE bucket_info.allowed_mime_types END,
    'provided_content_type', content_type,
    'detected_content_type', real_content_type,
    'filename', filename,
    'would_be_allowed', 
      CASE 
        WHEN bucket_info IS NULL THEN false
        WHEN bucket_info.allowed_mime_types IS NULL THEN true
        ELSE 
          CASE WHEN real_content_type = ANY(bucket_info.allowed_mime_types) 
          THEN true ELSE false END
      END,
    'file_size_limit', CASE WHEN bucket_info IS NULL THEN NULL ELSE bucket_info.file_size_limit END,
    'policies', policy_info
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to fix existing broken uploads
CREATE OR REPLACE FUNCTION public.fix_broken_uploads()
RETURNS jsonb AS $$
DECLARE
  fixed_count integer := 0;
  broken_objs jsonb;
BEGIN
  -- Find objects that might be broken by checking their content type and size
  WITH broken_objects AS (
    SELECT id, name, bucket_id, content_type, metadata
    FROM storage.objects
    WHERE content_type LIKE 'multipart/form-data%'
    OR content_type IS NULL
    OR metadata->>'size' IS NULL
    OR (metadata->>'size')::int < 100
  )
  SELECT jsonb_agg(jsonb_build_object(
    'id', id,
    'name', name,
    'bucket_id', bucket_id,
    'content_type', content_type,
    'metadata', metadata
  )) INTO broken_objs
  FROM broken_objects;
  
  -- Return diagnostic information
  RETURN jsonb_build_object(
    'broken_objects', broken_objs,
    'timestamp', now(),
    'note', 'These objects may need to be re-uploaded. The content may be corrupted.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to sanitize filenames for safety
CREATE OR REPLACE FUNCTION public.sanitize_filename(filename text)
RETURNS text AS $$
DECLARE
  clean_name text;
  extension text;
  name_part text;
BEGIN
  -- Get extension and name separately
  extension := lower(substring(filename from '\.([^\.]+)$'));
  name_part := substring(filename from '^(.+)\.[^\.]+$');
  
  -- If no extension or name part found, handle it
  IF extension IS NULL THEN extension := ''; END IF;
  IF name_part IS NULL THEN name_part := filename; END IF;
  
  -- Remove any non-alphanumeric characters from name part (except dash and underscore)
  name_part := regexp_replace(name_part, '[^a-zA-Z0-9\-_]', '', 'g');
  
  -- Limit name part length
  IF length(name_part) > 50 THEN
    name_part := substring(name_part from 1 for 50);
  END IF;
  
  -- Only allow specific safe extensions
  IF extension NOT IN ('jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif') THEN
    extension := 'jpg';  -- Default to jpg for safety
  END IF;
  
  -- Combine parts
  IF extension = '' THEN
    clean_name := name_part;
  ELSE
    clean_name := name_part || '.' || extension;
  END IF;
  
  RETURN clean_name;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to generate a completely random unique name
CREATE OR REPLACE FUNCTION public.generate_safe_random_filename(extension text DEFAULT 'jpg')
RETURNS text AS $$
DECLARE
  timestamp_part text;
  random_part text;
  safe_extension text;
BEGIN
  -- Ensure extension is safe
  IF extension NOT IN ('jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif') THEN
    safe_extension := 'jpg';  -- Default to jpg for safety
  ELSE
    safe_extension := extension;
  END IF;
  
  -- Generate timestamp (format: YYYYMMDDHHMMSS)
  timestamp_part := to_char(now(), 'YYYYMMDDHHMI24SS');
  
  -- Generate 12 characters of hex for uniqueness
  random_part := lower(encode(gen_random_bytes(6), 'hex'));
  
  -- Return sanitized filename with no original filename influence
  RETURN timestamp_part || '-' || random_part || '.' || safe_extension;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.validate_image_mime_type(text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.generate_unique_filename(text, text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.diagnose_storage_upload(text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fix_broken_uploads() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sanitize_filename(text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.generate_safe_random_filename(text) TO authenticated, anon, service_role;

COMMIT; 