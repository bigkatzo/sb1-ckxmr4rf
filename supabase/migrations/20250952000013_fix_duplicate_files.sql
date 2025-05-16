/*
  # Fix Duplicate Files and Enable Proper Overwriting
  
  This migration addresses duplicate file issues by:
  1. Creating a function to detect and remove duplicate files
  2. Adding a special policy to allow overwriting existing files
  3. Fixing the existing RLS policy to allow upsert operations
  4. Creating a special cleanup function to fix current corrupt files
  5. ALWAYS generating a unique filename regardless of existing files
*/

BEGIN;

-- Set highest privileges for this migration
SET LOCAL ROLE postgres;

-- Function to detect and delete duplicate files by name
CREATE OR REPLACE FUNCTION public.remove_duplicate_file(
  bucket_id text,
  file_name text
) 
RETURNS jsonb AS $$
DECLARE
  count_deleted integer := 0;
  result jsonb;
BEGIN
  -- Delete existing file with exact filename match
  DELETE FROM storage.objects
  WHERE bucket_id = remove_duplicate_file.bucket_id
  AND name = remove_duplicate_file.file_name
  RETURNING count(*) INTO count_deleted;
  
  -- Return result
  RETURN jsonb_build_object(
    'deleted', count_deleted > 0,
    'count', count_deleted,
    'bucket', bucket_id,
    'file_name', file_name,
    'timestamp', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to ensure a file can be uploaded with ALWAYS a unique name
CREATE OR REPLACE FUNCTION public.prepare_file_upload(
  bucket_id text,
  original_name text,
  force_unique boolean DEFAULT true -- Kept for backward compatibility, but we now always use unique
)
RETURNS jsonb AS $$
DECLARE
  safe_name text;
  extension text;
  file_exists boolean;
BEGIN
  -- Extract extension
  extension := lower(substring(original_name from '\.([^\.]+)$'));
  
  -- Ensure we have a valid extension
  IF extension IS NULL OR extension = '' OR extension !~ '^[a-z0-9]+$' THEN
    extension := 'jpg'; -- Default to jpg for safety
  END IF;
  
  -- ALWAYS generate a completely new, unique filename based on timestamp and random data
  -- This is the key change - we no longer try to preserve the original name at all
  safe_name := public.generate_safe_random_filename(extension);
  
  -- Check if file exists (just for reporting)
  SELECT EXISTS(
    SELECT 1 FROM storage.objects
    WHERE bucket_id = prepare_file_upload.bucket_id
    AND name = safe_name
  ) INTO file_exists;
  
  -- In the extremely unlikely case our random name already exists, regenerate
  IF file_exists THEN
    -- Try a second time with even more randomness
    safe_name := public.generate_safe_random_filename(extension) || '-' || 
                 lower(encode(gen_random_bytes(4), 'hex'));
  END IF;
  
  -- Return information
  RETURN jsonb_build_object(
    'bucket_id', bucket_id,
    'original_name', original_name,
    'safe_name', safe_name,
    'extension', extension,
    'is_guaranteed_unique', true,
    'timestamp', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a more direct function for simple use cases
CREATE OR REPLACE FUNCTION public.get_unique_filename(
  original_name text DEFAULT 'file.jpg'
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
  
  -- Generate timestamp (format: YYYYMMDDHHMMSS)
  timestamp_part := to_char(now(), 'YYYYMMDDHHMI24SS');
  
  -- Generate 12 characters of hex for increased uniqueness
  random_part := lower(encode(gen_random_bytes(6), 'hex'));
  
  -- Return simple timestamp-random.extension format
  RETURN timestamp_part || '-' || random_part || '.' || extension;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Drop and recreate upsert policy to ensure files can be properly replaced
DROP POLICY IF EXISTS "Allow file replacement" ON storage.objects;

CREATE POLICY "Allow file replacement" 
  ON storage.objects
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    bucket_id IN ('collection-images', 'product-images', 'site-assets', 'profile-images')
  );

-- Special RLS policy to ensure DELETE is allowed for duplicates
DROP POLICY IF EXISTS "Allow delete for duplicate resolution" ON storage.objects;

CREATE POLICY "Allow delete for duplicate resolution" 
  ON storage.objects
  FOR DELETE 
  TO authenticated, anon, service_role
  USING (bucket_id IN ('collection-images', 'product-images', 'site-assets', 'profile-images'));

-- Create a function to clean up all duplicate files
CREATE OR REPLACE FUNCTION public.clean_duplicate_files()
RETURNS jsonb AS $$
DECLARE
  row_record record;
  dup_count integer := 0;
  result jsonb := '[]'::jsonb;
BEGIN
  -- Find duplicate files by name for each bucket
  FOR row_record IN
    WITH duplicates AS (
      SELECT bucket_id, name, COUNT(*) count
      FROM storage.objects
      GROUP BY bucket_id, name
      HAVING COUNT(*) > 1
    )
    SELECT d.bucket_id, d.name, d.count, 
           array_agg(o.id) as ids, 
           array_agg(o.created_at) as created_ats
    FROM duplicates d
    JOIN storage.objects o ON d.bucket_id = o.bucket_id AND d.name = o.name
    GROUP BY d.bucket_id, d.name, d.count
  LOOP
    -- Keep only the newest file, delete others
    BEGIN
      WITH ordered_duplicates AS (
        SELECT id, created_at,
               ROW_NUMBER() OVER (PARTITION BY bucket_id, name ORDER BY created_at DESC) as rn
        FROM storage.objects
        WHERE bucket_id = row_record.bucket_id AND name = row_record.name
      )
      DELETE FROM storage.objects
      WHERE id IN (
        SELECT id FROM ordered_duplicates WHERE rn > 1
      );
      
      dup_count := dup_count + row_record.count - 1;
      
      -- Add to result
      result := result || jsonb_build_object(
        'bucket_id', row_record.bucket_id,
        'name', row_record.name,
        'original_count', row_record.count,
        'deleted_count', row_record.count - 1
      );
    EXCEPTION WHEN OTHERS THEN
      -- Continue with next duplicate if there's an error
      CONTINUE;
    END;
  END LOOP;
  
  RETURN jsonb_build_object(
    'total_duplicates_found', dup_count,
    'files_cleaned', result,
    'timestamp', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.remove_duplicate_file(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.prepare_file_upload(text, text, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.clean_duplicate_files() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_unique_filename(text) TO authenticated, anon, service_role;

-- Run cleanup of any existing duplicates
SELECT public.clean_duplicate_files();

COMMIT; 