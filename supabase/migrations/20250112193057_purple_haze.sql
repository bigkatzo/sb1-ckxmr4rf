/*
  # Fix Storage Bucket Policies

  1. Changes
    - Drop existing storage policies
    - Create new unified policies for both buckets
    - Add proper RLS for authenticated users
    - Enable public read access
    
  2. Security
    - Only authenticated users can upload/modify files
    - Public read access for all files
    - Files are owned by the uploading user
*/

-- Drop existing storage policies
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Auth Insert Access" ON storage.objects;
DROP POLICY IF EXISTS "Auth Update Access" ON storage.objects;
DROP POLICY IF EXISTS "Auth Delete Access" ON storage.objects;

-- Create new storage policies
CREATE POLICY "Public Read Access"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "Authenticated Insert Access"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('collection-images', 'product-images')
  );

CREATE POLICY "Authenticated Update Access"
  ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('collection-images', 'product-images')
    AND auth.uid() = owner
  );

CREATE POLICY "Authenticated Delete Access"
  ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id IN ('collection-images', 'product-images')
    AND auth.uid() = owner
  );