-- Drop existing policies first
DO $$ BEGIN
  DROP POLICY IF EXISTS "public_read" ON storage.objects;
  DROP POLICY IF EXISTS "authenticated_write" ON storage.objects;
  DROP POLICY IF EXISTS "authenticated_update" ON storage.objects;
  DROP POLICY IF EXISTS "authenticated_delete" ON storage.objects;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Recreate objects table with minimal required columns
DO $$ BEGIN
  ALTER TABLE IF EXISTS storage.objects 
    DROP COLUMN IF EXISTS owner CASCADE,
    DROP COLUMN IF EXISTS owner_id CASCADE;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Ensure objects table has correct structure
CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text NOT NULL,
  name text NOT NULL,
  size bigint,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_accessed_at timestamptz DEFAULT now(),
  version text DEFAULT '1',
  content_type text,
  path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/')) STORED
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS objects_bucket_id_idx ON storage.objects (bucket_id);
CREATE INDEX IF NOT EXISTS objects_name_idx ON storage.objects (name);
CREATE INDEX IF NOT EXISTS objects_path_tokens_idx ON storage.objects USING gin (path_tokens);

-- Ensure buckets exist with proper configuration
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
CREATE POLICY "public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "authenticated_write"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "authenticated_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "authenticated_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id IN ('collection-images', 'product-images'));