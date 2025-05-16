-- Migration to update the filename generation functions to use collection-based format
-- This ensures consistent filename generation between client and server side

BEGIN;

-- Update the function to generate safe random filenames with collection prefix
CREATE OR REPLACE FUNCTION public.generate_safe_random_filename(
  extension text DEFAULT 'jpg',
  collection text DEFAULT 'default'
)
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
  
  -- Return collection-based filename format without separators
  RETURN collection || random_part || timestamp_part || '.' || safe_extension;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Update the get_unique_filename function to use the new format with collection
CREATE OR REPLACE FUNCTION public.get_unique_filename(
  original_name text DEFAULT 'file.jpg',
  collection text DEFAULT 'default'
)
RETURNS text AS $$
DECLARE
  extension text;
  timestamp_part text;
  random_part text;
BEGIN
  -- Extract extension
  extension := lower(substring(original_name from '\.([^\.]+)$'));
  
  -- Ensure we have a valid extension
  IF extension IS NULL OR extension = '' OR extension !~ '^[a-z0-9]+$' THEN
    extension := 'jpg'; -- Default to jpg for safety
  END IF;
  
  -- Generate timestamp
  timestamp_part := to_char(now(), 'YYYYMMDDHHMI24SS');
  
  -- Generate random hex
  random_part := lower(encode(gen_random_bytes(6), 'hex'));
  
  -- Return collection-based format without separators
  RETURN collection || random_part || timestamp_part || '.' || extension;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.generate_safe_random_filename(text, text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_unique_filename(text, text) TO authenticated, anon, service_role;

COMMIT; 