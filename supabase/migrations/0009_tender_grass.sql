/*
  # Fix storage policies

  1. Changes
    - Drop all existing storage policies to avoid conflicts
    - Create new unified policies for both collection and product images
    - Add proper RLS policies with owner-based checks
    
  2. Security
    - Enable RLS on storage.objects
    - Add policies for public read access
    - Add policies for authenticated users to manage their own files
*/

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop all existing storage policies to start fresh
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete" ON storage.objects;
DROP POLICY IF EXISTS "Public Access - Product Images" ON storage.objects;
DROP POLICY IF EXISTS "Auth Upload - Product Images" ON storage.objects;
DROP POLICY IF EXISTS "Auth Update - Product Images" ON storage.objects;
DROP POLICY IF EXISTS "Auth Delete - Product Images" ON storage.objects;
DROP POLICY IF EXISTS "Give public access to collection images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload collection images" ON storage.objects;

-- Create unified policies for all storage buckets
CREATE POLICY "Public Read Access"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "Auth Insert Access"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('collection-images', 'product-images')
    AND (auth.uid() = owner)
  );

CREATE POLICY "Auth Update Access"
  ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('collection-images', 'product-images')
    AND (auth.uid() = owner)
  );

CREATE POLICY "Auth Delete Access"
  ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id IN ('collection-images', 'product-images')
    AND (auth.uid() = owner)
  );