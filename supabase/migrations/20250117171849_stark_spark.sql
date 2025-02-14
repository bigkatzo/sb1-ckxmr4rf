-- Drop existing policies first
DO $$ BEGIN
  DROP POLICY IF EXISTS "collections_view" ON collections;
  DROP POLICY IF EXISTS "collections_manage" ON collections;
  DROP POLICY IF EXISTS "collections_modify" ON collections;
  DROP POLICY IF EXISTS "collections_remove" ON collections;
  DROP POLICY IF EXISTS "products_view" ON products;
  DROP POLICY IF EXISTS "products_manage" ON products;
  DROP POLICY IF EXISTS "products_modify" ON products;
  DROP POLICY IF EXISTS "products_remove" ON products;
  DROP POLICY IF EXISTS "categories_view" ON categories;
  DROP POLICY IF EXISTS "categories_manage" ON categories;
  DROP POLICY IF EXISTS "categories_modify" ON categories;
  DROP POLICY IF EXISTS "categories_remove" ON categories;
  DROP POLICY IF EXISTS "collections_policy" ON collections;
  DROP POLICY IF EXISTS "products_policy" ON products;
  DROP POLICY IF EXISTS "categories_policy" ON categories;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create function to check user role
CREATE OR REPLACE FUNCTION auth.get_user_role()
RETURNS text AS $$
BEGIN
  RETURN COALESCE(
    (
      SELECT role FROM user_profiles 
      WHERE id = auth.uid()
    ),
    'user'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check collection access level
CREATE OR REPLACE FUNCTION auth.get_collection_access(collection_id uuid)
RETURNS text AS $$
BEGIN
  -- Admin has full access
  IF auth.is_admin() THEN
    RETURN 'manage';
  END IF;

  -- Check if user owns collection
  IF EXISTS (
    SELECT 1 FROM collections
    WHERE id = collection_id
    AND user_id = auth.uid()
  ) THEN
    RETURN 'manage';
  END IF;

  -- Check if user has explicit access
  RETURN COALESCE(
    (
      SELECT access_type 
      FROM collection_access
      WHERE collection_id = collection_id
      AND user_id = auth.uid()
    ),
    'none'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RLS policies for collections
CREATE POLICY "merchant_collections_view"
  ON collections FOR SELECT
  TO authenticated
  USING (
    visible = true 
    OR auth.get_collection_access(id) != 'none'
  );

CREATE POLICY "merchant_collections_manage"
  ON collections FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.get_user_role() IN ('admin', 'merchant')
  );

CREATE POLICY "merchant_collections_modify"
  ON collections FOR UPDATE
  TO authenticated
  USING (auth.get_collection_access(id) = 'manage')
  WITH CHECK (auth.get_collection_access(id) = 'manage');

CREATE POLICY "merchant_collections_remove"
  ON collections FOR DELETE
  TO authenticated
  USING (auth.get_collection_access(id) = 'manage');

-- Create RLS policies for products
CREATE POLICY "merchant_products_view"
  ON products FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND (
        c.visible = true 
        OR auth.get_collection_access(c.id) != 'none'
      )
    )
  );

CREATE POLICY "merchant_products_manage"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.get_collection_access(collection_id) = 'manage'
  );

CREATE POLICY "merchant_products_modify"
  ON products FOR UPDATE
  TO authenticated
  USING (auth.get_collection_access(collection_id) = 'manage')
  WITH CHECK (auth.get_collection_access(collection_id) = 'manage');

CREATE POLICY "merchant_products_remove"
  ON products FOR DELETE
  TO authenticated
  USING (auth.get_collection_access(collection_id) = 'manage');

-- Create RLS policies for categories
CREATE POLICY "merchant_categories_view"
  ON categories FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND (
        c.visible = true 
        OR auth.get_collection_access(c.id) != 'none'
      )
    )
  );

CREATE POLICY "merchant_categories_manage"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.get_collection_access(collection_id) = 'manage'
  );

CREATE POLICY "merchant_categories_modify"
  ON categories FOR UPDATE
  TO authenticated
  USING (auth.get_collection_access(collection_id) = 'manage')
  WITH CHECK (auth.get_collection_access(collection_id) = 'manage');

CREATE POLICY "merchant_categories_remove"
  ON categories FOR DELETE
  TO authenticated
  USING (auth.get_collection_access(collection_id) = 'manage');

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION auth.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.get_collection_access(uuid) TO authenticated;