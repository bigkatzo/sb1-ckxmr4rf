-- Drop role-related tables and functions
DROP TABLE IF EXISTS user_permissions CASCADE;
DROP TABLE IF EXISTS collection_assignments CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;

-- Drop role-related functions
DROP FUNCTION IF EXISTS auth.get_role() CASCADE;
DROP FUNCTION IF EXISTS auth.is_merchant() CASCADE;
DROP FUNCTION IF EXISTS manage_user_role() CASCADE;
DROP FUNCTION IF EXISTS assign_collection_to_intern() CASCADE;

-- Simplify admin check to only admin420
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (
    SELECT email = 'admin420@merchant.local'
    FROM auth.users
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update collection access check
CREATE OR REPLACE FUNCTION auth.has_collection_access(collection_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN (
    -- Admin has access to everything
    auth.is_admin()
    OR
    -- Owner has access to own collections
    EXISTS (
      SELECT 1 FROM collections
      WHERE id = collection_id
      AND user_id = auth.uid()
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update collection policies
DROP POLICY IF EXISTS "Collection view policy" ON collections;
DROP POLICY IF EXISTS "Collection manage policy" ON collections;

CREATE POLICY "Collection view policy"
  ON collections FOR SELECT
  USING (
    visible = true 
    OR auth.has_collection_access(id)
  );

CREATE POLICY "Collection manage policy"
  ON collections FOR ALL
  TO authenticated
  USING (
    auth.is_admin() 
    OR user_id = auth.uid()
  )
  WITH CHECK (
    auth.is_admin() 
    OR user_id = auth.uid()
  );

-- Update product policies
DROP POLICY IF EXISTS "Product view policy" ON products;
DROP POLICY IF EXISTS "Product manage policy" ON products;

CREATE POLICY "Product view policy"
  ON products FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND (c.visible = true OR auth.has_collection_access(c.id))
    )
  );

CREATE POLICY "Product manage policy"
  ON products FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND (auth.is_admin() OR c.user_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND (auth.is_admin() OR c.user_id = auth.uid())
    )
  );

-- Update category policies
DROP POLICY IF EXISTS "Category view policy" ON categories;
DROP POLICY IF EXISTS "Category manage policy" ON categories;

CREATE POLICY "Category view policy"
  ON categories FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND (c.visible = true OR auth.has_collection_access(c.id))
    )
  );

CREATE POLICY "Category manage policy"
  ON categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND (auth.is_admin() OR c.user_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND (auth.is_admin() OR c.user_id = auth.uid())
    )
  );