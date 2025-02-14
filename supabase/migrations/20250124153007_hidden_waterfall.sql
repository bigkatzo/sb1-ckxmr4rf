-- Drop existing foreign key constraints
DO $$ BEGIN
  ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_product_id_fkey;
  ALTER TABLE transaction_logs DROP CONSTRAINT IF EXISTS transaction_logs_product_id_fkey;
  ALTER TABLE products DROP CONSTRAINT IF EXISTS products_collection_id_fkey;
  ALTER TABLE products DROP CONSTRAINT IF EXISTS products_category_id_fkey;
  ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_collection_id_fkey;
  ALTER TABLE collection_access DROP CONSTRAINT IF EXISTS collection_access_collection_id_fkey;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Recreate foreign key constraints with proper cascade behavior
ALTER TABLE orders
  ADD CONSTRAINT orders_product_id_fkey 
  FOREIGN KEY (product_id) 
  REFERENCES products(id) 
  ON DELETE CASCADE;

ALTER TABLE transaction_logs
  ADD CONSTRAINT transaction_logs_product_id_fkey 
  FOREIGN KEY (product_id) 
  REFERENCES products(id) 
  ON DELETE CASCADE;

ALTER TABLE products
  ADD CONSTRAINT products_collection_id_fkey 
  FOREIGN KEY (collection_id) 
  REFERENCES collections(id) 
  ON DELETE CASCADE;

ALTER TABLE products
  ADD CONSTRAINT products_category_id_fkey 
  FOREIGN KEY (category_id) 
  REFERENCES categories(id) 
  ON DELETE SET NULL;

ALTER TABLE categories
  ADD CONSTRAINT categories_collection_id_fkey 
  FOREIGN KEY (collection_id) 
  REFERENCES collections(id) 
  ON DELETE CASCADE;

ALTER TABLE collection_access
  ADD CONSTRAINT collection_access_collection_id_fkey 
  FOREIGN KEY (collection_id) 
  REFERENCES collections(id) 
  ON DELETE CASCADE;

-- Create function to safely delete collection
CREATE OR REPLACE FUNCTION delete_collection(p_collection_id uuid)
RETURNS void AS $$
BEGIN
  -- Verify caller is admin or collection owner
  IF NOT (
    auth.is_admin() OR 
    EXISTS (
      SELECT 1 FROM collections 
      WHERE id = p_collection_id 
      AND user_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'Only admin or collection owner can delete collection';
  END IF;

  -- Delete collection (will cascade to related records)
  DELETE FROM collections 
  WHERE id = p_collection_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION delete_collection(uuid) TO authenticated;