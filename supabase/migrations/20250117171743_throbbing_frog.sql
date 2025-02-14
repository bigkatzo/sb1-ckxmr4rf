-- Drop existing policies first
DO $$ BEGIN
  DROP POLICY IF EXISTS "collections_select" ON collections;
  DROP POLICY IF EXISTS "collections_insert" ON collections;
  DROP POLICY IF EXISTS "collections_update" ON collections;
  DROP POLICY IF EXISTS "collections_delete" ON collections;
  DROP POLICY IF EXISTS "products_select" ON products;
  DROP POLICY IF EXISTS "products_insert" ON products;
  DROP POLICY IF EXISTS "products_update" ON products;
  DROP POLICY IF EXISTS "products_delete" ON products;
  DROP POLICY IF EXISTS "categories_select" ON categories;
  DROP POLICY IF EXISTS "categories_insert" ON categories;
  DROP POLICY IF EXISTS "categories_update" ON categories;
  DROP POLICY IF EXISTS "categories_delete" ON categories;
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

  -- Check if user is merchant with access
  IF auth.get_user_role() = 'merchant' THEN
    RETURN COALESCE(
      (
        SELECT access_type 
        FROM collection_access
        WHERE collection_id = collection_id
        AND user_id = auth.uid()
      ),
      'none'
    );
  END IF;

  -- Regular users can only view if granted access
  IF EXISTS (
    SELECT 1 FROM collection_access
    WHERE collection_id = collection_id
    AND user_id = auth.uid()
    AND access_type = 'view'
  ) THEN
    RETURN 'view';
  END IF;

  -- Default no access
  RETURN 'none';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RLS policies for collections
CREATE POLICY "collections_view"
  ON collections FOR SELECT
  TO authenticated
  USING (
    visible = true 
    OR auth.get_collection_access(id) != 'none'
  );

CREATE POLICY "collections_manage"
  ON collections FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.get_user_role() IN ('admin', 'merchant')
  );

CREATE POLICY "collections_modify"
  ON collections FOR UPDATE
  TO authenticated
  USING (auth.get_collection_access(id) = 'manage')
  WITH CHECK (auth.get_collection_access(id) = 'manage');

CREATE POLICY "collections_remove"
  ON collections FOR DELETE
  TO authenticated
  USING (auth.get_collection_access(id) = 'manage');

-- Create RLS policies for products
CREATE POLICY "products_view"
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

CREATE POLICY "products_manage"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.get_collection_access(collection_id) = 'manage'
  );

CREATE POLICY "products_modify"
  ON products FOR UPDATE
  TO authenticated
  USING (auth.get_collection_access(collection_id) = 'manage')
  WITH CHECK (auth.get_collection_access(collection_id) = 'manage');

CREATE POLICY "products_remove"
  ON products FOR DELETE
  TO authenticated
  USING (auth.get_collection_access(collection_id) = 'manage');

-- Create RLS policies for categories
CREATE POLICY "categories_view"
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

CREATE POLICY "categories_manage"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.get_collection_access(collection_id) = 'manage'
  );

CREATE POLICY "categories_modify"
  ON categories FOR UPDATE
  TO authenticated
  USING (auth.get_collection_access(collection_id) = 'manage')
  WITH CHECK (auth.get_collection_access(collection_id) = 'manage');

CREATE POLICY "categories_remove"
  ON categories FOR DELETE
  TO authenticated
  USING (auth.get_collection_access(collection_id) = 'manage');

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION auth.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.get_collection_access(uuid) TO authenticated;