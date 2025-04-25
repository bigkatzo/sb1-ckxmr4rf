-- Enable pgcrypto extension if it doesn't already exist
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create a safe fallback function for gen_random_bytes
CREATE OR REPLACE FUNCTION safe_random_bytes(num_bytes integer)
RETURNS bytea AS $$
BEGIN
  -- Try using gen_random_bytes if available
  BEGIN
    RETURN gen_random_bytes(num_bytes);
  EXCEPTION WHEN undefined_function THEN
    -- Fall back to uuid-based solution for 4 bytes (common case)
    IF num_bytes = 4 THEN
      RETURN decode(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8), 'hex');
    ELSE
      -- For other sizes, use multiple UUIDs
      RETURN decode(substring(replace(gen_random_uuid()::text || replace(gen_random_uuid()::text, '-', ''), '-', ''), 1, num_bytes * 2), 'hex');
    END IF;
  END;
END;
$$ LANGUAGE plpgsql;

-- Create a fully sanitized filename generation function that removes special characters
CREATE OR REPLACE FUNCTION generate_safe_storage_filename(
  original_name text,
  bucket text
)
RETURNS text AS $$
DECLARE
  file_extension text;
  base_name text;
  timestamp text;
  random_str text;
  sanitized_name text;
BEGIN
  -- Extract file extension
  file_extension := COALESCE(NULLIF(regexp_replace(original_name, '^.*\.', ''), original_name), '');
  
  -- Get base name without extension
  base_name := CASE 
    WHEN file_extension != '' THEN regexp_replace(original_name, '\.' || file_extension || '$', '')
    ELSE original_name
  END;

  -- Generate timestamp with no special characters
  timestamp := to_char(now(), 'YYYYMMDDHHMMSS');
  
  -- Generate random string using safe method
  random_str := encode(safe_random_bytes(4), 'hex');

  -- Clean base name - completely remove special characters
  sanitized_name := regexp_replace(
    regexp_replace(
      regexp_replace(
        lower(base_name),
        '[^a-z0-9]+', '-', 'g'  -- Replace all non-alphanumeric with hyphens
      ),
      '-+', '-', 'g'  -- Replace multiple hyphens with single hyphen
    ),
    '^-+|-+$', '', 'g'  -- Remove leading/trailing hyphens
  );

  -- Build storage path with timestamp and random string first for uniqueness
  -- This ensures filenames with special characters won't cause issues
  RETURN format(
    '%s/%s-%s-%s.%s',
    bucket,
    timestamp,
    random_str,
    sanitized_name,
    COALESCE(NULLIF(file_extension, ''), 'jpg')
  );
END;
$$ LANGUAGE plpgsql;

-- Create a trigger function to automatically sanitize filenames on upload
CREATE OR REPLACE FUNCTION storage_sanitize_filename_trigger()
RETURNS trigger AS $$
DECLARE
  path_parts text[];
  bucket text;
  filename text;
  sanitized_path text;
BEGIN
  -- Extract bucket and filename from path
  path_parts := string_to_array(NEW.name, '/');
  
  -- Get bucket (first part)
  bucket := path_parts[1];
  
  -- Get filename (last part)
  filename := path_parts[array_length(path_parts, 1)];
  
  -- Generate sanitized path
  sanitized_path := generate_safe_storage_filename(filename, bucket);
  
  -- Update path
  NEW.name := sanitized_path;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to sanitize file names on upload
DROP TRIGGER IF EXISTS storage_filename_sanitize_trigger ON storage.objects;
CREATE TRIGGER storage_filename_sanitize_trigger
  BEFORE INSERT ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION storage_sanitize_filename_trigger();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION safe_random_bytes(integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION generate_safe_storage_filename(text, text) TO authenticated, anon; 