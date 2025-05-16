/*
  # Unified Storage Fix
  
  This migration provides a clean, unified fix for all storage issues by:
  1. Removing all conflicting policies
  2. Setting buckets to public with no MIME type restrictions
  3. Creating simple, permissive policies
  4. Granting appropriate permissions to all roles
*/

-- Run with highest privileges
SET ROLE postgres;

BEGIN;

-- 1. Drop all existing storage policies to avoid conflicts
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

-- 2. Ensure buckets exist and are set to public with no MIME type restrictions
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('collection-images', 'collection-images', true, 10485760, NULL), -- 10MB
  ('product-images', 'product-images', true, 10485760, NULL),       -- 10MB
  ('site-assets', 'site-assets', true, 15728640, NULL),             -- 15MB
  ('profile-images', 'profile-images', true, 10485760, NULL)        -- 10MB
ON CONFLICT (id) DO UPDATE 
SET 
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = NULL; -- Remove all MIME type restrictions

-- 3. Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 4. Create simple, permissive policies

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

-- 5. Grant all necessary permissions
GRANT USAGE ON SCHEMA storage TO public, anon, authenticated, service_role;
GRANT SELECT ON storage.buckets TO public, anon, authenticated, service_role;
GRANT ALL ON storage.buckets TO service_role;
GRANT SELECT ON storage.objects TO public, anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON storage.objects TO authenticated, service_role;
GRANT ALL ON storage.objects TO service_role;

-- 6. Cleanup - Remove any potentially problematic triggers
DO $$ 
BEGIN
  DROP TRIGGER IF EXISTS validate_mime_type_trigger ON storage.objects;
  DROP TRIGGER IF EXISTS validate_file_trigger ON storage.objects; 
  DROP TRIGGER IF EXISTS validate_upload_trigger ON storage.objects;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- 7. Create a diagnostic function to check storage configuration
CREATE OR REPLACE FUNCTION public.check_storage_config()
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  -- Get bucket information
  WITH bucket_info AS (
    SELECT
      id,
      public,
      file_size_limit,
      allowed_mime_types
    FROM storage.buckets
    WHERE id IN ('collection-images', 'product-images', 'site-assets', 'profile-images')
  ),
  
  -- Get policy information
  policy_info AS (
    SELECT 
      policyname,
      cmd,
      roles
    FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
  )
  
  -- Build result
  SELECT jsonb_build_object(
    'timestamp', now(),
    'buckets', COALESCE(jsonb_agg(b.*), '[]'::jsonb),
    'policies', (SELECT COALESCE(jsonb_agg(p.*), '[]'::jsonb) FROM policy_info p),
    'success', true
  ) INTO result
  FROM bucket_info b;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Grant execute privilege on diagnostic function
GRANT EXECUTE ON FUNCTION public.check_storage_config() TO authenticated, service_role;

COMMIT; 