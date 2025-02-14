-- Drop all existing storage policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "storage_select" ON storage.objects;
  DROP POLICY IF EXISTS "storage_insert" ON storage.objects;
  DROP POLICY IF EXISTS "storage_update" ON storage.objects;
  DROP POLICY IF EXISTS "storage_delete" ON storage.objects;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Drop owner-related columns if they exist
DO $$ BEGIN
  ALTER TABLE storage.objects 
    DROP COLUMN IF EXISTS owner CASCADE,
    DROP COLUMN IF EXISTS owner_id CASCADE;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Recreate objects table with minimal required columns
TRUNCATE TABLE storage.objects;
ALTER TABLE storage.objects 
  DROP CONSTRAINT IF EXISTS objects_owner_fkey CASCADE,
  DROP CONSTRAINT IF EXISTS objects_owner_id_fkey CASCADE;

-- Ensure buckets are configured correctly
UPDATE storage.buckets 
SET 
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
WHERE id IN ('collection-images', 'product-images');

-- Create maximally permissive policies for authenticated users
CREATE POLICY "storage_select"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "storage_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "storage_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "storage_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id IN ('collection-images', 'product-images'));

-- Grant all necessary permissions
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO authenticated;
GRANT USAGE ON SCHEMA storage TO authenticated;