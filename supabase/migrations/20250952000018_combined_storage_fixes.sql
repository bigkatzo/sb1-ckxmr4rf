-- Combined migration file for all storage bucket fixes
-- This ensures proper configuration for uploads and resolves MIME type issues

BEGIN;

-- 1. Ensure buckets exist and are configured correctly with broad MIME type support
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('collection-images', 'collection-images', true, 10485760, NULL), -- 10MB, allow any MIME type
  ('product-images', 'product-images', true, 10485760, NULL),       -- 10MB, allow any MIME type
  ('site-assets', 'site-assets', true, 15728640, NULL),             -- 15MB, allow any MIME type
  ('profile-images', 'profile-images', true, 10485760, NULL)        -- 10MB, allow any MIME type
ON CONFLICT (id) DO UPDATE 
SET 
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = NULL; -- Remove all MIME type restrictions to work with any image type

-- 2. Drop all existing storage policies to avoid conflicts
DO $$ 
DECLARE
  pol record;
BEGIN
  -- Drop all existing policies with error handling
  FOR pol IN (
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'objects' AND schemaname = 'storage'
  ) LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
    EXCEPTION WHEN OTHERS THEN
      -- Log error but continue
      RAISE NOTICE 'Failed to drop policy %: %', pol.policyname, SQLERRM;
    END;
  END LOOP;
END $$;

-- 3. Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 4. Create simple, permissive policies for storage access

-- Allow public read access to all objects in our buckets
CREATE POLICY "Public read access"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id IN ('collection-images', 'product-images', 'site-assets', 'profile-images'));

-- Allow authenticated users to upload files to our buckets
CREATE POLICY "Authenticated upload access"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id IN ('collection-images', 'product-images', 'site-assets', 'profile-images'));

-- Allow authenticated users to update files in our buckets
CREATE POLICY "Authenticated update access"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id IN ('collection-images', 'product-images', 'site-assets', 'profile-images'));

-- Allow authenticated users to delete files in our buckets
CREATE POLICY "Authenticated delete access"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id IN ('collection-images', 'product-images', 'site-assets', 'profile-images'));

-- 5. Drop existing functions to avoid conflicts
DO $$ 
BEGIN
  -- Drop functions with safe error handling
  DROP FUNCTION IF EXISTS public.diagnose_storage_upload_issue(TEXT);
  DROP FUNCTION IF EXISTS public.fix_nested_file_paths();
  DROP FUNCTION IF EXISTS public.get_unique_filename(TEXT, TEXT);
  DROP FUNCTION IF EXISTS public.get_unique_filename(TEXT);
EXCEPTION 
  WHEN undefined_function THEN
    -- Ignore errors about non-existent functions
    NULL;
END $$;

-- 6. Create a diagnostic function to help debug upload issues
CREATE OR REPLACE FUNCTION public.diagnose_storage_upload_issue(
  bucket_name TEXT DEFAULT 'collection-images'
)
RETURNS JSONB AS $$
DECLARE
  bucket_info JSONB;
  policies_info JSONB;
  result JSONB;
BEGIN
  -- Get bucket configuration
  SELECT jsonb_build_object(
    'id', id,
    'name', name,
    'public', public,
    'file_size_limit', file_size_limit,
    'allowed_mime_types', allowed_mime_types
  ) INTO bucket_info
  FROM storage.buckets 
  WHERE id = bucket_name;
  
  -- Get policies information
  SELECT jsonb_agg(jsonb_build_object(
    'name', policyname,
    'action', cmd,
    'roles', roles
  )) INTO policies_info
  FROM pg_policies
  WHERE schemaname = 'storage' 
  AND tablename = 'objects';
  
  -- Check for potential issues
  result := jsonb_build_object(
    'bucket_exists', bucket_info IS NOT NULL,
    'bucket_info', COALESCE(bucket_info, '{}'::JSONB),
    'policies', COALESCE(policies_info, '[]'::JSONB),
    'has_public_read_policy', EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'storage' 
      AND tablename = 'objects'
      AND cmd = 'SELECT'
      AND permissive = true
    ),
    'has_write_policy', EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'storage' 
      AND tablename = 'objects'
      AND cmd = 'INSERT'
      AND permissive = true
    ),
    'rls_enabled', (
      SELECT relrowsecurity FROM pg_class
      JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
      WHERE pg_namespace.nspname = 'storage'
      AND pg_class.relname = 'objects'
    ),
    'time', now()
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Function to fix nested file paths (like "file.png/nested.png")
CREATE OR REPLACE FUNCTION public.fix_nested_file_paths()
RETURNS TABLE (
  bucket_id TEXT,
  path TEXT,
  fixed_path TEXT,
  fixed BOOLEAN
) AS $$
DECLARE
  total_fixed INTEGER := 0;
BEGIN
  -- Temporary table to hold records that need fixing
  CREATE TEMP TABLE files_to_fix (
    bucket_id TEXT,
    name TEXT,
    fixed_name TEXT
  );
  
  -- Find files with nested paths
  INSERT INTO files_to_fix
  SELECT 
    bucket_id,
    name,
    regexp_replace(name, '([^/]+\.[^/]+)/.*$', '\1') as fixed_name
  FROM storage.objects
  WHERE name ~ '.+\..+/.+';
  
  -- Process each file
  FOR bucket_id, path, fixed_path IN
    SELECT bucket_id, name, fixed_name 
    FROM files_to_fix
  LOOP
    -- Return the current record
    RETURN NEXT;
    total_fixed := total_fixed + 1;
    
    -- Fix the path - uncomment to actually fix
    UPDATE storage.objects
    SET name = fixed_path
    WHERE bucket_id = bucket_id AND name = path;
  END LOOP;
  
  -- Drop temp table
  DROP TABLE files_to_fix;
  
  -- Return a summary row
  bucket_id := 'TOTAL';
  path := '';
  fixed_path := '';
  fixed := total_fixed > 0;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Function to get a unique filename by collection
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

-- 9. Grant all necessary permissions
GRANT USAGE ON SCHEMA storage TO public, anon, authenticated, service_role;
GRANT SELECT ON storage.buckets TO public, anon, authenticated, service_role;
GRANT ALL ON storage.buckets TO service_role;
GRANT SELECT ON storage.objects TO public, anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON storage.objects TO authenticated, service_role;
GRANT ALL ON storage.objects TO service_role;

-- Grant execution permissions on our helper functions
GRANT EXECUTE ON FUNCTION public.diagnose_storage_upload_issue(TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.fix_nested_file_paths() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_unique_filename(TEXT, TEXT) TO authenticated, anon, service_role;

COMMIT; 