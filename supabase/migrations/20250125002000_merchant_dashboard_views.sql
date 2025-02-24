-- Drop existing merchant views if they exist
DROP VIEW IF EXISTS merchant_collections CASCADE;
DROP VIEW IF EXISTS merchant_products CASCADE;
DROP VIEW IF EXISTS merchant_categories CASCADE;

-- Drop existing functions with full signatures
DROP FUNCTION IF EXISTS get_merchant_collections();
DROP FUNCTION IF EXISTS get_merchant_products(uuid);
DROP FUNCTION IF EXISTS get_merchant_categories(uuid);
DROP FUNCTION IF EXISTS can_edit_collection(uuid);
DROP FUNCTION IF EXISTS can_view_collection(uuid);
DROP FUNCTION IF EXISTS is_admin() CASCADE;

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS collections_admin_all_policy ON collections;
DROP POLICY IF EXISTS collection_access_admin_all_policy ON collection_access;

-- Create admin check function first
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM user_profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  );
$$;

-- Recreate the policies that depend on is_admin()
CREATE POLICY collections_admin_all_policy ON collections
  FOR ALL
  TO authenticated
  USING ((SELECT is_admin()));

CREATE POLICY collection_access_admin_all_policy ON collection_access
  FOR ALL
  TO authenticated
  USING ((SELECT is_admin()));

-- Create merchant dashboard views
CREATE VIEW merchant_collections AS
SELECT 
  c.*,
  CASE 
    WHEN c.user_id = auth.uid() THEN NULL
    WHEN ca.access_type IS NOT NULL THEN ca.access_type
    ELSE NULL
  END as access_type
FROM collections c
LEFT JOIN collection_access ca ON ca.collection_id = c.id AND ca.user_id = auth.uid()
WHERE 
  (SELECT is_admin()) OR  -- Admin can see all collections
  c.user_id = auth.uid() OR  -- User owns the collection
  ca.collection_id IS NOT NULL;  -- User has access through collection_access

CREATE VIEW merchant_products AS
SELECT 
  p.*,
  c.name as collection_name,
  c.user_id as collection_owner_id,
  CASE 
    WHEN c.user_id = auth.uid() THEN NULL
    WHEN ca.access_type IS NOT NULL THEN ca.access_type
    ELSE NULL
  END as access_type
FROM products p
JOIN collections c ON c.id = p.collection_id
LEFT JOIN collection_access ca ON ca.collection_id = c.id AND ca.user_id = auth.uid()
WHERE 
  (SELECT is_admin()) OR  -- Admin can see all products
  c.user_id = auth.uid() OR  -- User owns the collection
  ca.collection_id IS NOT NULL;  -- User has access through collection_access

CREATE VIEW merchant_categories AS
SELECT 
  cat.*,
  c.name as collection_name,
  c.user_id as collection_owner_id,
  CASE 
    WHEN c.user_id = auth.uid() THEN NULL
    WHEN ca.access_type IS NOT NULL THEN ca.access_type
    ELSE NULL
  END as access_type
FROM categories cat
JOIN collections c ON c.id = cat.collection_id
LEFT JOIN collection_access ca ON ca.collection_id = c.id AND ca.user_id = auth.uid()
WHERE 
  (SELECT is_admin()) OR  -- Admin can see all categories
  c.user_id = auth.uid() OR  -- User owns the collection
  ca.collection_id IS NOT NULL;  -- User has access through collection_access

-- Grant access to authenticated users
GRANT SELECT ON merchant_collections TO authenticated;
GRANT SELECT ON merchant_products TO authenticated;
GRANT SELECT ON merchant_categories TO authenticated;

-- Helper functions for merchant dashboard
CREATE OR REPLACE FUNCTION get_merchant_collections()
RETURNS SETOF merchant_collections
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM merchant_collections
  ORDER BY created_at DESC;
$$;

CREATE OR REPLACE FUNCTION get_merchant_products(p_collection_id uuid)
RETURNS SETOF merchant_products
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM merchant_products
  WHERE collection_id = p_collection_id
  ORDER BY created_at DESC;
$$;

CREATE OR REPLACE FUNCTION get_merchant_categories(p_collection_id uuid)
RETURNS SETOF merchant_categories
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM merchant_categories
  WHERE collection_id = p_collection_id
  ORDER BY created_at DESC;
$$;

-- Function to check if user can edit a collection
CREATE OR REPLACE FUNCTION can_edit_collection(p_collection_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM merchant_collections
    WHERE id = p_collection_id
    AND (
      (SELECT is_admin()) OR  -- Admin can edit all collections
      user_id = auth.uid() OR  -- User owns the collection
      access_type = 'edit'     -- User has edit access
    )
  );
$$;

-- Function to check if user can view a collection
CREATE OR REPLACE FUNCTION can_view_collection(p_collection_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM merchant_collections
    WHERE id = p_collection_id
  );
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION get_merchant_collections() TO authenticated;
GRANT EXECUTE ON FUNCTION get_merchant_products(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_merchant_categories(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION can_edit_collection(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION can_view_collection(uuid) TO authenticated;

-- Add documentation
COMMENT ON FUNCTION is_admin() IS 'Checks if the current user is an admin';
COMMENT ON VIEW merchant_collections IS 'Collections accessible to the current merchant user or all collections for admin';
COMMENT ON VIEW merchant_products IS 'Products in collections accessible to the current merchant user or all products for admin';
COMMENT ON VIEW merchant_categories IS 'Categories in collections accessible to the current merchant user or all categories for admin';
COMMENT ON FUNCTION get_merchant_collections() IS 'Returns all collections accessible to the current merchant user or all collections for admin';
COMMENT ON FUNCTION get_merchant_products(uuid) IS 'Returns all products in a collection accessible to the current merchant user or all products for admin';
COMMENT ON FUNCTION get_merchant_categories(uuid) IS 'Returns all categories in a collection accessible to the current merchant user or all categories for admin';
COMMENT ON FUNCTION can_edit_collection(uuid) IS 'Checks if the current user can edit the specified collection';
COMMENT ON FUNCTION can_view_collection(uuid) IS 'Checks if the current user can view the specified collection'; 