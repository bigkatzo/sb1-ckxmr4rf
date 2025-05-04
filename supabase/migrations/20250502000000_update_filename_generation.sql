-- Migration script to update the file naming convention
-- Removing original filename and using only timestamp + random string for more robust names

-- Update the filename generation function to eliminate usage of original filename
CREATE OR REPLACE FUNCTION generate_safe_storage_filename(
  original_name text,
  bucket text
)
RETURNS text AS $$
DECLARE
  file_extension text;
  timestamp text;
  random_str text;
BEGIN
  -- Extract file extension safely
  file_extension := COALESCE(NULLIF(regexp_replace(original_name, '^.*\.', ''), original_name), '');
  
  -- Generate timestamp with no special characters
  timestamp := to_char(now(), 'YYYYMMDDHHMMSS');
  
  -- Generate random string using safe method with more bytes for increased uniqueness
  random_str := encode(safe_random_bytes(6), 'hex');

  -- Build storage path with timestamp and random string only
  -- This eliminates any issues from original filenames with special characters
  RETURN format(
    '%s/%s-%s.%s',
    bucket,
    timestamp,
    random_str,
    COALESCE(NULLIF(file_extension, ''), 'jpg')
  );
END;
$$ LANGUAGE plpgsql;

-- No changes needed to trigger function as it continues to use the updated generate_safe_storage_filename function

-- Announce the migration in logs
DO $$
BEGIN
  RAISE NOTICE 'Migration completed: Updated file naming convention to remove original filename';
END $$; 