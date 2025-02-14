-- Drop existing policies
DO $$ BEGIN
  -- Collections
  DROP POLICY IF EXISTS "Public read collections" ON collections;
  DROP POLICY IF EXISTS "Merchant insert collections" ON collections;
  DROP POLICY IF EXISTS "Merchant update collections" ON collections;
  DROP POLICY IF EXISTS "Merchant delete collections" ON collections;
  
  -- Products
  DROP POLICY IF EXISTS "Public read products" ON products;
  DROP POLICY IF EXISTS "Merchant insert products" ON products;
  DROP POLICY IF EXISTS "Merchant update products" ON products;
  DROP POLICY IF EXISTS "Merchant delete products" ON products;
  
  -- Categories
  DROP POLICY IF EXISTS "Public read categories" ON categories;
  DROP POLICY IF EXISTS "Merchant insert categories" ON categories;
  DROP POLICY IF EXISTS "Merchant update categories" ON categories;
  DROP POLICY IF EXISTS "Merchant delete categories" ON categories;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create simplified policies for collections
CREATE POLICY "Collections access"
  ON collections
  USING (
    -- Anyone can read public collections
    visible = true 
    OR 
    -- Authenticated users can access their own collections
    (auth.role() = 'authenticated' AND auth.uid() = user_id)
  )
  WITH CHECK (
    -- Only authenticated users can modify, and only their own collections
    auth.role() = 'authenticated' AND auth.uid() = user_id
  );

-- Create simplified policies for products
CREATE POLICY "Products access"
  ON products
  USING (
    -- Anyone can read products from public collections
    EXISTS (
      SELECT 1 FROM collections 
      WHERE collections.id = products.collection_id 
      AND (
        collections.visible = true
        OR 
        (auth.role() = 'authenticated' AND collections.user_id = auth.uid())
      )
    )
  )
  WITH CHECK (
    -- Only authenticated users can modify, and only products in their collections
    auth.role() = 'authenticated' 
    AND 
    EXISTS (
      SELECT 1 FROM collections 
      WHERE collections.id = products.collection_id 
      AND collections.user_id = auth.uid()
    )
  );

-- Create simplified policies for categories
CREATE POLICY "Categories access"
  ON categories
  USING (
    -- Anyone can read categories from public collections
    EXISTS (
      SELECT 1 FROM collections 
      WHERE collections.id = categories.collection_id 
      AND (
        collections.visible = true
        OR 
        (auth.role() = 'authenticated' AND collections.user_id = auth.uid())
      )
    )
  )
  WITH CHECK (
    -- Only authenticated users can modify, and only categories in their collections
    auth.role() = 'authenticated' 
    AND 
    EXISTS (
      SELECT 1 FROM collections 
      WHERE collections.id = categories.collection_id 
      AND collections.user_id = auth.uid()
    )
  );

-- Create helper function to check collection ownership
CREATE OR REPLACE FUNCTION is_collection_owner(collection_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM collections
    WHERE id = collection_id
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;