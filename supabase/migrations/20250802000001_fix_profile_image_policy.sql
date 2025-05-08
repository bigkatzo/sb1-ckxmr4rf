-- Drop existing policies for profile-images bucket
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can upload their profile image" ON storage.objects;
  DROP POLICY IF EXISTS "Users can update their profile image" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete their profile image" ON storage.objects;
  DROP POLICY IF EXISTS "Public can read profile images" ON storage.objects;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create new policies for profile-images bucket without the owner condition
-- Instead, we'll rely on path-based security (user ID in the path)

-- Policy allowing any authenticated user to read profile images
CREATE POLICY "Public can read profile images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'profile-images');

-- Policy allowing any authenticated user to upload to their own folder (userId/*)
CREATE POLICY "Users can upload their profile image"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profile-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy allowing users to update files in their own folder
CREATE POLICY "Users can update their profile image"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'profile-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy allowing users to delete files in their own folder
CREATE POLICY "Users can delete their profile image"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'profile-images' AND
    (storage.foldername(name))[1] = auth.uid()::text
  ); 