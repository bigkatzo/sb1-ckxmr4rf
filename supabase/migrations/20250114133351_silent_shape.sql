-- Drop all existing storage policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "storage_select" ON storage.objects;
  DROP POLICY IF EXISTS "storage_insert" ON storage.objects;
  DROP POLICY IF EXISTS "storage_update" ON storage.objects;
  DROP POLICY IF EXISTS "storage_delete" ON storage.objects;
  DROP POLICY IF EXISTS "storage_objects_select_policy" ON storage.objects;
  DROP POLICY IF EXISTS "storage_objects_insert_policy" ON storage.objects;
  DROP POLICY IF EXISTS "storage_objects_update_policy" ON storage.objects;
  DROP POLICY IF EXISTS "storage_objects_delete_policy" ON storage.objects;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Recreate objects table to ensure correct structure
DROP TABLE IF EXISTS storage.objects;
CREATE TABLE storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text NOT NULL REFERENCES storage.buckets(id),
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

-- Create indexes
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
CREATE POLICY "storage_select"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "storage_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id IN ('collection-images', 'product-images')
    AND (storage.foldername(name))[1] != 'private'
  );

CREATE POLICY "storage_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "storage_delete"
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