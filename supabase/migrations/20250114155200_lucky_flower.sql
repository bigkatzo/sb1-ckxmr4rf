-- Create function to handle file metadata and ownership
CREATE OR REPLACE FUNCTION storage.handle_file_upload()
RETURNS trigger AS $$
BEGIN
  -- Set owner and owner_id to current user
  NEW.owner := auth.uid();
  NEW.owner_id := auth.uid();

  -- Set basic metadata
  NEW.metadata := jsonb_build_object(
    'mimetype', NEW.content_type,
    'size', NEW.size,
    'created_at', NEW.created_at
  );

  -- Set user metadata
  NEW.user_metadata := jsonb_build_object(
    'uploaded_by', auth.uid(),
    'original_name', split_part(NEW.name, '-', 1)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS handle_file_upload_trigger ON storage.objects;

-- Create trigger to run before insert
CREATE TRIGGER handle_file_upload_trigger
  BEFORE INSERT ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION storage.handle_file_upload();

-- Update storage policies to ensure proper access
DROP POLICY IF EXISTS "storage_read" ON storage.objects;
DROP POLICY IF EXISTS "storage_write" ON storage.objects;
DROP POLICY IF EXISTS "storage_modify" ON storage.objects;
DROP POLICY IF EXISTS "storage_delete" ON storage.objects;

-- Create simplified storage policies
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
  USING (
    bucket_id IN ('collection-images', 'product-images') 
    AND owner = auth.uid()
  );

CREATE POLICY "storage_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id IN ('collection-images', 'product-images')
    AND owner = auth.uid()
  );