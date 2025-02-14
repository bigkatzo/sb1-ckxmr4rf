-- Drop all existing policies
DO $$ BEGIN
  -- Collections
  DROP POLICY IF EXISTS "Collection view policy" ON collections;
  DROP POLICY IF EXISTS "Collection manage policy" ON collections;
  
  -- Products
  DROP POLICY IF EXISTS "Product view policy" ON products;
  DROP POLICY IF EXISTS "Product manage policy" ON products;
  
  -- Categories
  DROP POLICY IF EXISTS "Category view policy" ON categories;
  DROP POLICY IF EXISTS "Category manage policy" ON categories;
  
  -- Storage
  DROP POLICY IF EXISTS "Storage read" ON storage.objects;
  DROP POLICY IF EXISTS "Storage write" ON storage.objects;
  DROP POLICY IF EXISTS "Storage modify" ON storage.objects;
  DROP POLICY IF EXISTS "Storage delete" ON storage.objects;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create fresh policies for collections
CREATE POLICY "collections_read"
  ON collections FOR SELECT
  USING (visible = true OR auth.uid() = user_id);

CREATE POLICY "collections_insert"
  ON collections FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "collections_update"
  ON collections FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "collections_delete"
  ON collections FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create fresh policies for products
CREATE POLICY "products_read"
  ON products FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = products.collection_id
      AND (collections.visible = true OR collections.user_id = auth.uid())
    )
  );

CREATE POLICY "products_insert"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = products.collection_id
      AND collections.user_id = auth.uid()
    )
  );

CREATE POLICY "products_update"
  ON products FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = products.collection_id
      AND collections.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = products.collection_id
      AND collections.user_id = auth.uid()
    )
  );

CREATE POLICY "products_delete"
  ON products FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = products.collection_id
      AND collections.user_id = auth.uid()
    )
  );

-- Create fresh policies for categories
CREATE POLICY "categories_read"
  ON categories FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = categories.collection_id
      AND (collections.visible = true OR collections.user_id = auth.uid())
    )
  );

CREATE POLICY "categories_insert"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = categories.collection_id
      AND collections.user_id = auth.uid()
    )
  );

CREATE POLICY "categories_update"
  ON categories FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = categories.collection_id
      AND collections.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = categories.collection_id
      AND collections.user_id = auth.uid()
    )
  );

CREATE POLICY "categories_delete"
  ON categories FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = categories.collection_id
      AND collections.user_id = auth.uid()
    )
  );

-- Create fresh policies for storage
CREATE POLICY "storage_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "storage_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id IN ('collection-images', 'product-images')
    AND (storage.foldername(name))[1] != 'private'
  );

CREATE POLICY "storage_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "storage_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id IN ('collection-images', 'product-images'));

-- Ensure storage buckets are configured correctly
UPDATE storage.buckets 
SET public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
WHERE id IN ('collection-images', 'product-images');

-- Create file validation function
CREATE OR REPLACE FUNCTION storage.validate_file()
RETURNS trigger AS $$
BEGIN
  -- Check file size
  IF NEW.size > 5242880 THEN
    RAISE EXCEPTION 'File size exceeds maximum limit of 5MB';
  END IF;

  -- Check mime type
  IF NEW.content_type NOT IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif') THEN
    RAISE EXCEPTION 'Invalid file type. Only JPEG, PNG, WebP and GIF images are allowed';
  END IF;

  -- Ensure file path is valid
  IF (storage.foldername(NEW.name))[1] = 'private' THEN
    RAISE EXCEPTION 'Cannot upload to private folder';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create file validation trigger
DROP TRIGGER IF EXISTS validate_file_trigger ON storage.objects;
CREATE TRIGGER validate_file_trigger
  BEFORE INSERT ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION storage.validate_file();