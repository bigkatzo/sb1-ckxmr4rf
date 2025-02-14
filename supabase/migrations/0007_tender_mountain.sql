/*
  # Fix storage policies for collection images

  1. Updates
    - Drops existing policies that may be causing conflicts
    - Creates new simplified policies for storage access
    - Ensures proper access control for authenticated users

  2. Security
    - Maintains public read access
    - Allows authenticated users full access to manage their uploads
*/

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Give public access to collection images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload collection images" ON storage.objects;

-- Create simplified policies
CREATE POLICY "Public Access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'collection-images');

CREATE POLICY "Authenticated users can upload"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'collection-images');

CREATE POLICY "Authenticated users can update"
  ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'collection-images');

CREATE POLICY "Authenticated users can delete"
  ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'collection-images');