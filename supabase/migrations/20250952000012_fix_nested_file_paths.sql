/*
  # Fix Nested File Paths
  
  This migration addresses nested file paths like "file.png/nested.png" by:
  1. Improving the clean_file_path function to handle this case
  2. Adding a function to detect and fix nested file paths
  3. Creating a function to fully sanitize uploaded file paths
*/

BEGIN;

-- Enhanced clean_file_path function to handle nested files
CREATE OR REPLACE FUNCTION public.clean_file_path(file_path text)
RETURNS text AS $$
DECLARE
  file_extension text;
  base_name text;
  path_parts text[];
  last_part text;
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
  
  -- Handle nested file paths like "file.png/nested.png"
  IF file_path ~ '\.[^/]+/' THEN
    -- Split by slash
    path_parts := string_to_array(file_path, '/');
    
    -- Check if more than one part and if any part before the last has an extension
    IF array_length(path_parts, 1) > 1 THEN
      -- Get the last part (the actual filename)
      last_part := path_parts[array_length(path_parts, 1)];
      
      -- Return only the last part to avoid nesting
      file_path := last_part;
    END IF;
  END IF;
  
  -- Replace any potentially problematic characters in the path
  file_path := regexp_replace(file_path, '[^a-zA-Z0-9\.\-_/]', '', 'g');
  
  RETURN file_path;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to fix all nested file paths
CREATE OR REPLACE FUNCTION public.fix_nested_file_paths()
RETURNS jsonb AS $$
DECLARE
  fixed_count integer := 0;
  row_record record;
  old_path text;
  new_path text;
  fixed_paths jsonb := '[]'::jsonb;
BEGIN
  -- Find all records with paths that contain nested files (extension followed by slash)
  FOR row_record IN
    SELECT id, name, bucket_id, content_type
    FROM storage.objects
    WHERE name ~ '\.[^/]+/'
  LOOP
    old_path := row_record.name;
    
    -- Split path by slash and keep only the last part
    SELECT array_to_string(ARRAY[
      -- Use regexp to get the last part after the last slash
      regexp_replace(old_path, '^.*/([^/]+)$', '\1')
    ], '') INTO new_path;
    
    -- If there's no match (no slashes), keep original
    IF new_path = '' OR new_path IS NULL THEN
      new_path := old_path;
    END IF;
    
    -- Further clean the path
    new_path := public.clean_file_path(new_path);
    
    -- Only update if paths are different
    IF new_path <> old_path THEN
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
    END IF;
  END LOOP;
  
  -- Return a summary
  RETURN jsonb_build_object(
    'fixed_count', fixed_count,
    'fixed_paths', fixed_paths,
    'timestamp', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to comprehensively sanitize a file path for upload
CREATE OR REPLACE FUNCTION public.sanitize_upload_path(
  bucket_id text,
  original_path text,
  force_unique boolean DEFAULT true
)
RETURNS text AS $$
DECLARE
  file_extension text;
  sanitized_path text;
  unique_name text;
BEGIN
  -- Extract extension
  file_extension := lower(substring(original_path from '\.([^\.]+)$'));
  
  -- Default extension if none found
  IF file_extension IS NULL OR file_extension = '' THEN
    file_extension := 'jpg';
  END IF;
  
  -- Handle force_unique first
  IF force_unique THEN
    -- Generate completely random unique name
    sanitized_path := public.generate_safe_random_filename(file_extension);
  ELSE
    -- Try to preserve original name but sanitize it
    sanitized_path := public.sanitize_filename(original_path);
  END IF;
  
  -- Apply all path cleanups
  sanitized_path := public.clean_file_path(sanitized_path);
  
  RETURN sanitized_path;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.fix_nested_file_paths() TO service_role;
GRANT EXECUTE ON FUNCTION public.sanitize_upload_path(text, text, boolean) TO authenticated, anon, service_role;

-- Run fix
SELECT public.fix_nested_file_paths();

COMMIT; 