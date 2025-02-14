-- Drop existing triggers and policies
DROP TRIGGER IF EXISTS sanitize_filename_trigger ON storage.objects;
DROP TRIGGER IF EXISTS handle_file_upload_trigger ON storage.objects;
DROP POLICY IF EXISTS "storage_read" ON storage.objects;
DROP POLICY IF EXISTS "storage_write" ON storage.objects;
DROP POLICY IF EXISTS "storage_modify" ON storage.objects;
DROP POLICY IF EXISTS "storage_delete" ON storage.objects;

-- Create simplified file upload handler
CREATE OR REPLACE FUNCTION storage.handle_file_upload()
RETURNS trigger AS $$
BEGIN
  -- Set owner and owner_id
  NEW.owner := auth.uid();
  NEW.owner_id := auth.uid();

  -- Set basic metadata
  NEW.metadata := jsonb_build_object(
    'size', NEW.size,
    'mimetype', NEW.content_type,
    'lastModified', extract(epoch from now()) * 1000,
    'type', NEW.content_type
  );

  -- Set user metadata
  NEW.user_metadata := jsonb_build_object(
    'uploader', auth.uid(),
    'originalName', NEW.name
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for file upload
CREATE TRIGGER handle_file_upload_trigger
  BEFORE INSERT ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION storage.handle_file_upload();

-- Create maximally permissive policies for public access
CREATE POLICY "storage_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "storage_write"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "storage_modify"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "storage_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id IN ('collection-images', 'product-images'));

-- Ensure buckets are public
UPDATE storage.buckets 
SET public = true 
WHERE id IN ('collection-images', 'product-images');