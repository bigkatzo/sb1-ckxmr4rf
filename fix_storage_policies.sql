-- Direct SQL script to fix product-design-files bucket storage policies
-- This can be run directly from the Supabase dashboard SQL editor

-- Check if product-design-files bucket exists, if not create it
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('product-design-files', 'product-design-files', true, 10485760, 
   ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'application/json'])
ON CONFLICT (id) DO UPDATE 
SET 
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Drop existing policies first, then recreate them
DROP POLICY IF EXISTS "storage_read" ON storage.objects;
DROP POLICY IF EXISTS "storage_write" ON storage.objects;
DROP POLICY IF EXISTS "storage_modify" ON storage.objects;
DROP POLICY IF EXISTS "storage_delete" ON storage.objects;

-- Also check for older policy names that might exist
DROP POLICY IF EXISTS "storage_select" ON storage.objects;
DROP POLICY IF EXISTS "storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "storage_update" ON storage.objects;

-- Create new storage access policies that include product-design-files
CREATE POLICY "storage_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id IN ('collection-images', 'product-images', 'site-assets', 'profile-images', 'product-design-files'));

CREATE POLICY "storage_write"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id IN ('collection-images', 'product-images', 'site-assets', 'profile-images', 'product-design-files'));

CREATE POLICY "storage_modify"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id IN ('collection-images', 'product-images', 'site-assets', 'profile-images', 'product-design-files'));

CREATE POLICY "storage_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id IN ('collection-images', 'product-images', 'site-assets', 'profile-images', 'product-design-files'));

-- Enable RLS (should already be enabled, but just in case)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions (should already be granted, but just in case)
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO authenticated;
GRANT USAGE ON SCHEMA storage TO authenticated; 