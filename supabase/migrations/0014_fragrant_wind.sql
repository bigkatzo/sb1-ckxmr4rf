/*
  # Update RLS policies for public access

  1. Changes
    - Add policies to allow public access to visible collections
    - Add policies to allow public access to categories in visible collections
    - Add policies to allow public access to products in visible collections

  2. Security
    - Only allows reading (SELECT) for public users
    - Only shows collections marked as visible = true
    - Categories and products are only visible if their collection is visible
*/

-- Update collections policies
DROP POLICY IF EXISTS "Public can view collections" ON collections;
CREATE POLICY "Public can view collections" 
  ON collections
  FOR SELECT 
  TO public
  USING (visible = true);

-- Update categories policies
DROP POLICY IF EXISTS "Public can view categories" ON categories;
CREATE POLICY "Public can view categories"
  ON categories
  FOR SELECT
  TO public
  USING (EXISTS (
    SELECT 1 FROM collections 
    WHERE collections.id = categories.collection_id
    AND collections.visible = true
  ));

-- Update products policies
DROP POLICY IF EXISTS "Public can view products" ON products;
CREATE POLICY "Public can view products"
  ON products
  FOR SELECT
  TO public
  USING (EXISTS (
    SELECT 1 FROM collections 
    WHERE collections.id = products.collection_id
    AND collections.visible = true
  ));