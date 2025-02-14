-- Drop existing storage policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "Public read storage" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated write storage" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated modify storage" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated delete storage" ON storage.objects;
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

-- Create simplified storage policies with no owner checks
CREATE POLICY "Storage public read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "Storage authenticated insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "Storage authenticated update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "Storage authenticated delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id IN ('collection-images', 'product-images'));

-- Remove any owner-related constraints
ALTER TABLE storage.objects 
  DROP CONSTRAINT IF EXISTS objects_owner_fkey CASCADE;

-- Remove owner column if it exists
DO $$ BEGIN
  ALTER TABLE storage.objects DROP COLUMN IF EXISTS owner;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;