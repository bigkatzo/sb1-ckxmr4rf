-- Migration to fix MIME type issues with collection-images bucket

BEGIN;

-- Update all buckets to explicitly accept all needed MIME types
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg', 
  'image/jpg', 
  'image/png', 
  'image/gif', 
  'image/webp', 
  'image/svg+xml',
  'application/octet-stream',  -- For binary uploads
  'image/*'                    -- Wildcard for any image type
]
WHERE id IN ('collection-images', 'product-images', 'site-assets', 'profile-images');

-- Make sure buckets are public
UPDATE storage.buckets
SET public = true
WHERE id IN ('collection-images', 'product-images', 'site-assets', 'profile-images');

-- Create a new diagnostic function to check if our uploads will work
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

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.diagnose_storage_upload_issue(TEXT) TO authenticated, anon, service_role;

COMMIT; 