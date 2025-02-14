-- Drop existing storage policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "storage_read_policy" ON storage.objects;
  DROP POLICY IF EXISTS "storage_insert_policy" ON storage.objects;
  DROP POLICY IF EXISTS "storage_update_policy" ON storage.objects;
  DROP POLICY IF EXISTS "storage_delete_policy" ON storage.objects;
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

-- Create simplified storage policies
CREATE POLICY "storage_read_policy"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "storage_insert_policy"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "storage_update_policy"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "storage_delete_policy"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id IN ('collection-images', 'product-images'));

-- Enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO authenticated;
GRANT USAGE ON SCHEMA storage TO authenticated;