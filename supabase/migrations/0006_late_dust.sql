/*
  # Add storage bucket for collection images

  1. New Storage
    - Creates a new public storage bucket for collection images
    - Enables public access to the bucket
    - Sets up RLS policies for authenticated users to upload images

  2. Security
    - Enables RLS on the bucket
    - Adds policy for authenticated users to upload images
    - Adds policy for public read access
*/

-- Create the storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('collection-images', 'collection-images', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow public access to images
CREATE POLICY "Give public access to collection images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'collection-images');

-- Allow authenticated users to upload images
CREATE POLICY "Allow authenticated users to upload collection images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'collection-images'
    AND (storage.foldername(name))[1] != 'private'
  );