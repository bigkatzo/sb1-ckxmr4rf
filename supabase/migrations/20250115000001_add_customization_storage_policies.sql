-- Add storage policies for customization-images bucket
-- This ensures proper access control for customization images

-- Create storage policies for customization-images bucket
CREATE POLICY "Customization images public read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'customization-images');

CREATE POLICY "Authenticated users can upload customization images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'customization-images'
    AND (storage.foldername(name))[1] != 'private'
  );

CREATE POLICY "Authenticated users can update customization images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'customization-images');

CREATE POLICY "Authenticated users can delete customization images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'customization-images');

-- Ensure the bucket is configured correctly
UPDATE storage.buckets 
SET public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
WHERE id = 'customization-images'; 