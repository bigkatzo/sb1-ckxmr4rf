-- Add variants column to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS variants jsonb DEFAULT '[]'::jsonb;

-- Create index for faster variant queries
CREATE INDEX IF NOT EXISTS idx_products_variants
ON products USING gin(variants);

-- Update RLS policies
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