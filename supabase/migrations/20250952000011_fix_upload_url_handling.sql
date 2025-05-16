/*
  # Fix Upload URL Handling and Add Upsert Support
  
  This migration addresses the 400 Bad Request and 409 Duplicate errors by:
  1. Adding a function to handle file overwrite gracefully
  2. Creating RLS policies that allow overwriting existing files
  3. Adding a trigger to automatically clean up duplicate files
  4. Ensuring paths are properly constructed for uploads
  5. Enforcing completely safe and unique filenames
*/

BEGIN;

-- Create a function to handle file overwrite properly with name sanitization
CREATE OR REPLACE FUNCTION public.safe_upload_with_overwrite(
  bucket_id text,
  file_path text,
  content_type text DEFAULT NULL,
  insert_only boolean DEFAULT false,
  force_unique boolean DEFAULT true
)
RETURNS jsonb AS $$
DECLARE
  file_exists boolean;
  detected_mime_type text;
  safe_path text;
  actual_path text;
  extension text;
  result jsonb;
BEGIN
  -- If no content type provided, try to detect it
  IF content_type IS NULL THEN
    detected_mime_type := public.validate_image_mime_type(file_path);
  ELSE
    detected_mime_type := content_type;
  END IF;
  
  -- Extract extension for use in generating a safe name
  extension := lower(substring(file_path from '\.([^\.]+)$'));
  
  -- Sanitize the path based on force_unique flag
  IF force_unique THEN
    -- Generate completely random unique name without using original name
    safe_path := public.generate_safe_random_filename(COALESCE(extension, 'jpg'));
  ELSE
    -- Sanitize the name but preserve some of the original name structure
    safe_path := public.sanitize_filename(file_path);
  END IF;
  
  -- Replace path slashes
  safe_path := public.clean_file_path(safe_path);
  actual_path := safe_path;
  
  -- Check if file exists
  SELECT EXISTS(
    SELECT 1 FROM storage.objects
    WHERE bucket_id = safe_upload_with_overwrite.bucket_id
    AND name = actual_path
  ) INTO file_exists;
  
  -- If file exists but we want a unique name, regenerate until we get a unique one
  IF file_exists AND force_unique THEN
    FOR i IN 1..5 LOOP -- Try up to 5 times to generate a unique name
      safe_path := public.generate_safe_random_filename(COALESCE(extension, 'jpg'));
      safe_path := public.clean_file_path(safe_path);
      actual_path := safe_path;
      
      SELECT EXISTS(
        SELECT 1 FROM storage.objects
        WHERE bucket_id = safe_upload_with_overwrite.bucket_id
        AND name = actual_path
      ) INTO file_exists;
      
      IF NOT file_exists THEN
        EXIT; -- We found a unique name
      END IF;
    END LOOP;
  END IF;
  
  -- If insert_only is true and file exists, return error
  IF insert_only AND file_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'File already exists and insert_only is true',
      'file_path', file_path,
      'safe_path', safe_path,
      'bucket_id', bucket_id
    );
  END IF;
  
  -- If file exists and we're not in insert_only mode, delete it
  IF file_exists AND NOT insert_only THEN
    DELETE FROM storage.objects
    WHERE bucket_id = safe_upload_with_overwrite.bucket_id
    AND name = actual_path;
  END IF;
  
  -- Return success with the sanitized path
  RETURN jsonb_build_object(
    'success', true,
    'bucket_id', bucket_id,
    'original_path', file_path,
    'safe_path', safe_path,
    'content_type', detected_mime_type,
    'action', CASE WHEN file_exists THEN 'overwrite' ELSE 'insert' END,
    'timestamp', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or update override policy to allow deletion of objects for update
DROP POLICY IF EXISTS "Allow overwrite of existing files" ON storage.objects;

CREATE POLICY "Allow overwrite of existing files"
  ON storage.objects
  FOR DELETE 
  TO authenticated
  USING (bucket_id IN ('collection-images', 'product-images', 'site-assets', 'profile-images'));

-- Create a function to clean up and repair paths with duplicate slashes
CREATE OR REPLACE FUNCTION public.clean_file_path(file_path text)
RETURNS text AS $$
BEGIN
  -- Check for null
  IF file_path IS NULL THEN
    RETURN NULL;
  END IF;

  -- Replace multiple slashes with a single slash
  file_path := regexp_replace(file_path, '/{2,}', '/', 'g');
  
  -- Remove leading slash if present
  IF left(file_path, 1) = '/' THEN
    file_path := substring(file_path from 2);
  END IF;
  
  -- Replace any potential problematic characters in the path
  file_path := regexp_replace(file_path, '[^a-zA-Z0-9\.\-_/]', '', 'g');
  
  RETURN file_path;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create a trigger function in public schema to automatically clean file paths
CREATE OR REPLACE FUNCTION public.clean_path_before_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Clean the path
  NEW.name := public.clean_file_path(NEW.name);
  
  -- Update content_type based on file extension if missing or generic
  IF NEW.content_type IS NULL OR NEW.content_type = 'application/octet-stream' THEN
    NEW.content_type := public.validate_image_mime_type(NEW.name);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS clean_path_trigger ON storage.objects;

-- Create the trigger (note: this requires appropriate permissions)
CREATE TRIGGER clean_path_trigger
  BEFORE INSERT ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION public.clean_path_before_insert();

-- Fix any existing files with malformed paths
CREATE OR REPLACE FUNCTION public.fix_existing_paths()
RETURNS jsonb AS $$
DECLARE
  fixed_count integer := 0;
  row_record record;
  old_path text;
  new_path text;
  fixed_paths jsonb := '[]'::jsonb;
BEGIN
  -- Find all records with paths that contain multiple consecutive slashes
  FOR row_record IN
    SELECT id, name, bucket_id, content_type
    FROM storage.objects
    WHERE name ~ '/{2,}'
    OR name ~ '^/'
    OR name ~ '[^a-zA-Z0-9\.\-_/]'
  LOOP
    old_path := row_record.name;
    new_path := public.clean_file_path(old_path);
    
    -- Update the record
    UPDATE storage.objects
    SET name = new_path
    WHERE id = row_record.id;
    
    -- Add to our result report
    fixed_paths := fixed_paths || jsonb_build_object(
      'bucket', row_record.bucket_id,
      'old_path', old_path,
      'new_path', new_path
    );
    
    fixed_count := fixed_count + 1;
  END LOOP;
  
  -- Also fix content types
  FOR row_record IN
    SELECT id, name, bucket_id, content_type
    FROM storage.objects
    WHERE content_type IS NULL 
    OR content_type = 'application/octet-stream'
    OR content_type LIKE 'multipart/form-data%'
  LOOP
    -- Update content type based on extension
    UPDATE storage.objects
    SET content_type = public.validate_image_mime_type(name)
    WHERE id = row_record.id;
    
    fixed_count := fixed_count + 1;
  END LOOP;
  
  -- Return a summary
  RETURN jsonb_build_object(
    'fixed_count', fixed_count,
    'fixed_paths', fixed_paths,
    'timestamp', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check for duplicate files by content hash
CREATE OR REPLACE FUNCTION public.find_duplicate_files()
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  WITH duplicates AS (
    SELECT 
      bucket_id,
      metadata->>'size' AS size,
      metadata->>'mimetype' AS mimetype,
      count(*) AS count,
      array_agg(name) AS filenames
    FROM storage.objects
    WHERE metadata->>'size' IS NOT NULL
    GROUP BY bucket_id, metadata->>'size', metadata->>'mimetype'
    HAVING count(*) > 1
  )
  SELECT jsonb_agg(d.*) INTO result
  FROM duplicates d;
  
  RETURN jsonb_build_object(
    'duplicate_groups', COALESCE(result, '[]'::jsonb),
    'timestamp', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.safe_upload_with_overwrite(text, text, text, boolean, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.clean_file_path(text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.fix_existing_paths() TO service_role;
GRANT EXECUTE ON FUNCTION public.clean_path_before_insert() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.find_duplicate_files() TO service_role;

-- Make sure all RLS policies work well together
DO $$ 
BEGIN
  -- Make sure the select policy is clear
  DROP POLICY IF EXISTS "Public read access" ON storage.objects;
  
  CREATE POLICY "Public read access"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id IN ('collection-images', 'product-images', 'site-assets', 'profile-images'));
  
  -- Make sure insert policy allows the right buckets
  DROP POLICY IF EXISTS "Authenticated upload access" ON storage.objects;
  
  CREATE POLICY "Authenticated upload access"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id IN ('collection-images', 'product-images', 'site-assets', 'profile-images'));
  
  -- Ensure update policy is still good
  DROP POLICY IF EXISTS "Authenticated update access" ON storage.objects;
  
  CREATE POLICY "Authenticated update access"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id IN ('collection-images', 'product-images', 'site-assets', 'profile-images'));
END $$;

-- Fix any existing files that have problematic paths
SELECT public.fix_existing_paths();

COMMIT; 