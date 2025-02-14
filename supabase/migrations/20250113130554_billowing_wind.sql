-- Drop existing storage policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "Storage public read" ON storage.objects;
  DROP POLICY IF EXISTS "Storage authenticated write" ON storage.objects;
  DROP POLICY IF EXISTS "Storage authenticated modify" ON storage.objects;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Ensure buckets are configured correctly
UPDATE storage.buckets 
SET public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
WHERE id IN ('collection-images', 'product-images');

-- Create simplified storage policies
CREATE POLICY "Public read storage"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "Authenticated write storage"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "Authenticated modify storage"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "Authenticated delete storage"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id IN ('collection-images', 'product-images'));

-- Remove any owner constraints
ALTER TABLE storage.objects 
  DROP CONSTRAINT IF EXISTS objects_owner_fkey CASCADE;