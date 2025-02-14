/*
  # Fix Storage Policies Final

  1. Changes
    - Drop all existing storage policies
    - Create simplified policies without owner checks
    - Enable public bucket access
    
  2. Security
    - Public read access for all files
    - Authenticated users can upload/modify files
    - No owner restrictions to avoid RLS issues
*/

-- Drop existing storage policies
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Insert Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete Access" ON storage.objects;

-- Make buckets public
UPDATE storage.buckets 
SET public = true 
WHERE id IN ('collection-images', 'product-images');

-- Create simplified policies
CREATE POLICY "Allow public read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "Allow authenticated insert"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "Allow authenticated update"
  ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "Allow authenticated delete"
  ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id IN ('collection-images', 'product-images'));