/*
  # Add public access policies

  1. Changes
    - Allow public access to collections
    - Allow public access to categories
    - Allow public access to products
    
  2. Security
    - Maintains existing authenticated user policies
    - Adds new policies for public access
*/

-- Update collections policies
CREATE POLICY "Public can view collections" 
  ON collections
  FOR SELECT 
  TO anon
  USING (visible = true);

-- Update categories policies
CREATE POLICY "Public can view categories"
  ON categories
  FOR SELECT
  TO anon
  USING (EXISTS (
    SELECT 1 FROM collections 
    WHERE collections.id = categories.collection_id
    AND collections.visible = true
  ));

-- Update products policies
CREATE POLICY "Public can view products"
  ON products
  FOR SELECT
  TO anon
  USING (EXISTS (
    SELECT 1 FROM collections 
    WHERE collections.id = products.collection_id
    AND collections.visible = true
  ));