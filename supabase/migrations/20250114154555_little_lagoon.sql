-- Create function to sanitize file names
CREATE OR REPLACE FUNCTION storage.sanitize_filename(filename text)
RETURNS text AS $$
DECLARE
  file_extension text;
  base_name text;
  timestamp text;
BEGIN
  -- Extract file extension
  file_extension := COALESCE(NULLIF(regexp_replace(filename, '^.*\.', ''), filename), '');
  
  -- Get base name without extension
  base_name := CASE 
    WHEN file_extension != '' THEN regexp_replace(filename, '\.' || file_extension || '$', '')
    ELSE filename
  END;

  -- Generate timestamp
  timestamp := to_char(now(), 'YYYYMMDD_HH24MISS');

  -- Clean base name:
  -- 1. Convert to lowercase
  -- 2. Replace spaces and special chars with hyphens
  -- 3. Remove consecutive hyphens
  -- 4. Remove leading/trailing hyphens
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

  -- Combine parts with timestamp
  RETURN CASE 
    WHEN file_extension != '' THEN 
      base_name || '-' || timestamp || '.' || file_extension
    ELSE 
      base_name || '-' || timestamp
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create trigger to sanitize filenames on insert
CREATE OR REPLACE FUNCTION storage.sanitize_filename_trigger()
RETURNS trigger AS $$
BEGIN
  NEW.name := storage.sanitize_filename(NEW.name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS sanitize_filename_trigger ON storage.objects;

-- Create trigger
CREATE TRIGGER sanitize_filename_trigger
  BEFORE INSERT ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION storage.sanitize_filename_trigger();