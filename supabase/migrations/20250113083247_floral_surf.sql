-- Drop any conflicting policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "Storage public read" ON storage.objects;
  DROP POLICY IF EXISTS "Storage authenticated insert" ON storage.objects;
  DROP POLICY IF EXISTS "Storage authenticated update" ON storage.objects;
  DROP POLICY IF EXISTS "Storage authenticated delete" ON storage.objects;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Ensure storage buckets are properly configured
UPDATE storage.buckets 
SET public = true 
WHERE id IN ('collection-images', 'product-images');

-- Create simplified storage policies without owner checks
CREATE POLICY "Storage public read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "Storage authenticated write"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "Storage authenticated modify"
  ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id IN ('collection-images', 'product-images'))
  WITH CHECK (bucket_id IN ('collection-images', 'product-images'));

-- Create function to safely get collection
CREATE OR REPLACE FUNCTION get_collection_safe(p_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  image_url text,
  launch_date timestamptz,
  visible boolean,
  featured boolean,
  slug text,
  user_id uuid
) AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.name, c.description, c.image_url, c.launch_date, 
         c.visible, c.featured, c.slug, c.user_id
  FROM collections c
  WHERE c.id = p_id
  AND (c.visible = true OR c.user_id = auth.uid())
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to safely get product
CREATE OR REPLACE FUNCTION get_product_safe(p_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  price numeric,
  collection_id uuid,
  category_id uuid,
  images text[],
  variants jsonb,
  variant_prices jsonb,
  slug text,
  sku text
) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.name, p.description, p.price, p.collection_id,
         p.category_id, p.images, p.variants, p.variant_prices,
         p.slug, p.sku
  FROM products p
  JOIN collections c ON c.id = p.collection_id
  WHERE p.id = p_id
  AND (c.visible = true OR c.user_id = auth.uid())
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;