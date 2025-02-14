-- Drop existing storage policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow public read" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated insert" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated update" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated delete" ON storage.objects;
  DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated Insert Access" ON storage.objects;
  DROP POLICY IF EXISTS "Owner Update Access" ON storage.objects;
  DROP POLICY IF EXISTS "Owner Delete Access" ON storage.objects;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Ensure buckets exist and are public
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
CREATE POLICY "Public Read Access"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "Authenticated Insert Access"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "Authenticated Update Access"
  ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "Authenticated Delete Access"
  ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id IN ('collection-images', 'product-images'));

-- Remove owner requirement from storage objects
ALTER TABLE storage.objects 
  DROP CONSTRAINT IF EXISTS objects_owner_fkey;