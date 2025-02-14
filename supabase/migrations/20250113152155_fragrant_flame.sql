-- Drop existing storage policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "Storage read" ON storage.objects;
  DROP POLICY IF EXISTS "Storage write" ON storage.objects;
  DROP POLICY IF EXISTS "Storage modify" ON storage.objects;
  DROP POLICY IF EXISTS "Storage delete" ON storage.objects;
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

-- Create function to validate file uploads
CREATE OR REPLACE FUNCTION storage.validate_file()
RETURNS trigger AS $$
BEGIN
  -- Check file size
  IF NEW.size > 5242880 THEN
    RAISE EXCEPTION 'File size exceeds maximum limit of 5MB';
  END IF;

  -- Check mime type
  IF NEW.content_type NOT IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif') THEN
    RAISE EXCEPTION 'Invalid file type. Only JPEG, PNG, WebP and GIF images are allowed';
  END IF;

  -- Ensure file path is valid
  IF (storage.foldername(NEW.name))[1] = 'private' THEN
    RAISE EXCEPTION 'Cannot upload to private folder';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for file validation
DROP TRIGGER IF EXISTS validate_file_trigger ON storage.objects;
CREATE TRIGGER validate_file_trigger
  BEFORE INSERT ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION storage.validate_file();