-- Drop existing storage policies to start fresh
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Allow public read" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated insert" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated update" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated delete" ON storage.objects;
EXCEPTION WHEN undefined_object THEN NULL;
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

-- Create storage policies with proper owner assignment
CREATE POLICY "Public Read Access"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "Authenticated Insert Access"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('collection-images', 'product-images')
    AND (storage.foldername(name))[1] != 'private'
  );

CREATE POLICY "Owner Update Access"
  ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('collection-images', 'product-images')
    AND owner = auth.uid()
  );

CREATE POLICY "Owner Delete Access"
  ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id IN ('collection-images', 'product-images')
    AND owner = auth.uid()
  );

-- Create function to handle file ownership
CREATE OR REPLACE FUNCTION storage.handle_file_ownership()
RETURNS trigger AS $$
BEGIN
  -- Set owner to authenticated user
  NEW.owner = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically set file ownership
DROP TRIGGER IF EXISTS set_file_owner ON storage.objects;
CREATE TRIGGER set_file_owner
  BEFORE INSERT ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION storage.handle_file_ownership();

-- Add helper function to validate file ownership
CREATE OR REPLACE FUNCTION storage.check_file_ownership(bucket_name text, file_path text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM storage.objects
    WHERE bucket_id = bucket_name
    AND name = file_path
    AND owner = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;