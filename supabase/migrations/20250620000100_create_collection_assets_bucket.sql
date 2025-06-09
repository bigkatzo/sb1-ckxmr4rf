-- Create storage bucket for collection assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('collection-assets', 'collection-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to upload to their collection folders
CREATE POLICY "Users can upload collection assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'collection-assets'
  AND (
    -- Check if user owns the collection
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id::text = (regexp_match(name, '^([^/]+)/'))[1]
      AND c.user_id = auth.uid()
    )
    OR
    -- Or if user has edit access to the collection
    EXISTS (
      SELECT 1 FROM collection_access ca
      WHERE ca.collection_id::text = (regexp_match(name, '^([^/]+)/'))[1]
      AND ca.user_id = auth.uid()
      AND ca.access_type = 'edit'
    )
  )
);

-- Create policy to allow authenticated users to update their collection assets
CREATE POLICY "Users can update collection assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'collection-assets'
  AND (
    -- Check if user owns the collection
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id::text = (regexp_match(name, '^([^/]+)/'))[1]
      AND c.user_id = auth.uid()
    )
    OR
    -- Or if user has edit access to the collection
    EXISTS (
      SELECT 1 FROM collection_access ca
      WHERE ca.collection_id::text = (regexp_match(name, '^([^/]+)/'))[1]
      AND ca.user_id = auth.uid()
      AND ca.access_type = 'edit'
    )
  )
);

-- Create policy to allow public to read collection assets
CREATE POLICY "Public can read collection assets"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'collection-assets');

-- Create policy to allow owners to delete their collection assets
CREATE POLICY "Users can delete collection assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'collection-assets'
  AND (
    -- Check if user owns the collection
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id::text = (regexp_match(name, '^([^/]+)/'))[1]
      AND c.user_id = auth.uid()
    )
    OR
    -- Or if user has edit access to the collection
    EXISTS (
      SELECT 1 FROM collection_access ca
      WHERE ca.collection_id::text = (regexp_match(name, '^([^/]+)/'))[1]
      AND ca.user_id = auth.uid()
      AND ca.access_type = 'edit'
    )
  )
); 