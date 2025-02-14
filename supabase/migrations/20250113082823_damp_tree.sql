-- Add indexes to improve query performance
CREATE INDEX IF NOT EXISTS idx_collections_user_id ON collections(user_id);
CREATE INDEX IF NOT EXISTS idx_products_collection_id ON products(collection_id);
CREATE INDEX IF NOT EXISTS idx_categories_collection_id ON categories(collection_id);

-- Create function to validate merchant ownership
CREATE OR REPLACE FUNCTION is_merchant_owner(collection_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM collections
    WHERE id = collection_id
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to validate product ownership
CREATE OR REPLACE FUNCTION is_product_owner(product_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM products p
    JOIN collections c ON c.id = p.collection_id
    WHERE p.id = product_id
    AND c.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to validate category ownership
CREATE OR REPLACE FUNCTION is_category_owner(category_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM categories cat
    JOIN collections c ON c.id = cat.collection_id
    WHERE cat.id = category_id
    AND c.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger function to validate collection ownership before modifications
CREATE OR REPLACE FUNCTION validate_collection_ownership()
RETURNS trigger AS $$
BEGIN
  IF NOT is_merchant_owner(NEW.collection_id) THEN
    RAISE EXCEPTION 'Access denied: You do not own this collection';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for products and categories
CREATE TRIGGER validate_product_ownership
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION validate_collection_ownership();

CREATE TRIGGER validate_category_ownership
  BEFORE INSERT OR UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION validate_collection_ownership();

-- Update RLS policies with enhanced security
ALTER POLICY "Merchant manage collections" ON collections
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

ALTER POLICY "Merchant manage products" ON products
USING (is_merchant_owner(collection_id))
WITH CHECK (is_merchant_owner(collection_id));

ALTER POLICY "Merchant manage categories" ON categories
USING (is_merchant_owner(collection_id))
WITH CHECK (is_merchant_owner(collection_id));