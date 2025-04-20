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

-- Fix functions that use gen_random_bytes by creating versions that use safe_random_bytes
-- Generate storage filename function
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
  
  -- Generate random string using safe method
  random_str := encode(safe_random_bytes(4), 'hex');

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
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION safe_random_bytes(integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION generate_storage_filename(text, text) TO authenticated, anon; 