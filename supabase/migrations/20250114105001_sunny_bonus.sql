-- Drop existing storage policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "Storage read" ON storage.objects;
  DROP POLICY IF EXISTS "Storage write" ON storage.objects;
  DROP POLICY IF EXISTS "Storage modify" ON storage.objects;
  DROP POLICY IF EXISTS "Storage delete" ON storage.objects;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Drop owner column if it exists
DO $$ BEGIN
  ALTER TABLE storage.objects DROP COLUMN IF EXISTS owner;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Ensure buckets exist and are configured correctly
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('collection-images', 'collection-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('product-images', 'product-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE 
SET 
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Create simplified storage policies without owner requirements
CREATE POLICY "Storage read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "Storage write"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id IN ('collection-images', 'product-images')
    AND (storage.foldername(name))[1] != 'private'
  );

CREATE POLICY "Storage modify"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "Storage delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id IN ('collection-images', 'product-images'));