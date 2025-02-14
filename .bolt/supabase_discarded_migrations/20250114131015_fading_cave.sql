-- Drop existing policies if they exist
DO $$ BEGIN
  DROP POLICY IF EXISTS "public_read" ON storage.objects;
  DROP POLICY IF EXISTS "authenticated_write" ON storage.objects;
  DROP POLICY IF EXISTS "authenticated_update" ON storage.objects;
  DROP POLICY IF EXISTS "authenticated_delete" ON storage.objects;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Remove owner-related columns if they exist
DO $$ BEGIN
  ALTER TABLE storage.objects 
    DROP COLUMN IF EXISTS owner CASCADE,
    DROP COLUMN IF EXISTS owner_id CASCADE;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Update bucket configuration
UPDATE storage.buckets 
SET 
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
WHERE id IN ('collection-images', 'product-images');

-- Create simplified storage policies
CREATE POLICY "public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "authenticated_write"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "authenticated_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "authenticated_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id IN ('collection-images', 'product-images'));