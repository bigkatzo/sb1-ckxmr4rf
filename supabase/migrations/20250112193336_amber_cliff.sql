/*
  # Comprehensive Database Fix

  1. Storage
    - Verify bucket configuration
    - Update storage policies
    - Add proper indexes
    
  2. Tables
    - Add missing indexes
    - Update constraints
    - Add helper functions
    
  3. Security
    - Update RLS policies
    - Add validation functions
*/

-- Verify buckets exist and are public
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('collection-images', 'collection-images', true),
  ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing storage policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Allow public read" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated insert" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated update" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated delete" ON storage.objects;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Create simplified storage policies
CREATE POLICY "Allow public read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "Allow authenticated insert"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "Allow authenticated update"
  ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id IN ('collection-images', 'product-images'));

CREATE POLICY "Allow authenticated delete"
  ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id IN ('collection-images', 'product-images'));

-- Add missing indexes
CREATE INDEX IF NOT EXISTS idx_collections_user_id ON collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collections_slug ON collections(slug);
CREATE INDEX IF NOT EXISTS idx_products_collection_id ON products(collection_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_categories_collection_id ON categories(collection_id);

-- Add helper function to validate collection ownership
CREATE OR REPLACE FUNCTION check_collection_ownership(collection_id uuid, user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM collections
    WHERE id = collection_id
    AND collections.user_id = check_collection_ownership.user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add helper function to validate product ownership
CREATE OR REPLACE FUNCTION check_product_ownership(product_id uuid, user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM products
    JOIN collections ON collections.id = products.collection_id
    WHERE products.id = product_id
    AND collections.user_id = check_product_ownership.user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS policies for collections
DROP POLICY IF EXISTS "Anyone can view visible collections" ON collections;
DROP POLICY IF EXISTS "Authenticated users can manage their collections" ON collections;

CREATE POLICY "Anyone can view visible collections"
ON collections FOR SELECT
USING (visible = true OR auth.uid() = user_id);

CREATE POLICY "Authenticated users can manage their collections"
ON collections FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Update RLS policies for products
DROP POLICY IF EXISTS "Public can view products in visible collections" ON products;
DROP POLICY IF EXISTS "Users can manage their products" ON products;

CREATE POLICY "Public can view products in visible collections"
ON products FOR SELECT
USING (EXISTS (
  SELECT 1 FROM collections
  WHERE collections.id = products.collection_id
  AND (collections.visible = true OR collections.user_id = auth.uid())
));

CREATE POLICY "Users can manage their products"
ON products FOR ALL
TO authenticated
USING (check_collection_ownership(collection_id, auth.uid()))
WITH CHECK (check_collection_ownership(collection_id, auth.uid()));

-- Update RLS policies for categories
DROP POLICY IF EXISTS "Public can view categories" ON categories;
DROP POLICY IF EXISTS "Users can manage their categories" ON categories;

CREATE POLICY "Public can view categories"
ON categories FOR SELECT
USING (EXISTS (
  SELECT 1 FROM collections
  WHERE collections.id = categories.collection_id
  AND (collections.visible = true OR collections.user_id = auth.uid())
));

CREATE POLICY "Users can manage their categories"
ON categories FOR ALL
TO authenticated
USING (check_collection_ownership(collection_id, auth.uid()))
WITH CHECK (check_collection_ownership(collection_id, auth.uid()));