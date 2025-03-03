-- Start transaction
BEGIN;

-- Drop existing merchant views
DROP VIEW IF EXISTS merchant_collections CASCADE;
DROP VIEW IF EXISTS merchant_products CASCADE;
DROP VIEW IF EXISTS merchant_categories CASCADE;

-- Drop existing functions
DROP FUNCTION IF EXISTS get_merchant_collections();
DROP FUNCTION IF EXISTS get_merchant_products(uuid);
DROP FUNCTION IF EXISTS get_merchant_categories(uuid);
DROP FUNCTION IF EXISTS can_edit_collection(uuid);
DROP FUNCTION IF EXISTS can_view_collection(uuid);

-- Create updated merchant dashboard views using denormalized collection_owner_id
CREATE VIEW merchant_collections AS
SELECT 
  c.*,
  u.raw_user_meta_data->>'username' as owner_username,
  CASE 
    WHEN c.user_id = auth.uid() THEN NULL
    WHEN ca.access_type IS NOT NULL THEN ca.access_type
    ELSE NULL
  END as access_type
FROM collections c
JOIN auth.users u ON u.id = c.user_id
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

-- Create updated helper functions for merchant dashboard
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

-- Update get_merchant_dashboard_data function to use denormalized data
CREATE OR REPLACE FUNCTION get_merchant_dashboard_data(p_user_id uuid)
RETURNS TABLE (
  collections json,
  products json,
  categories json,
  orders json
) AS $$
BEGIN
  -- For admin, return all data
  IF (SELECT is_admin()) THEN
    RETURN QUERY
    SELECT
      -- All collections with stats
      COALESCE(
        (SELECT json_agg(row_to_json(c))
         FROM (
           SELECT 
             c.*,
             COUNT(DISTINCT p.id) as product_count,
             COUNT(DISTINCT o.id) as order_count
           FROM collections c
           LEFT JOIN products p ON p.collection_id = c.id
           LEFT JOIN orders o ON o.product_id = p.id
           GROUP BY c.id
           ORDER BY c.created_at DESC
         ) c
        ),
        '[]'::json
      ),
      -- All products with related data
      COALESCE(
        (SELECT json_agg(row_to_json(p))
         FROM (
           SELECT 
             p.*,
             c.name as collection_name,
             cat.name as category_name,
             COUNT(o.id) as order_count
           FROM products p
           JOIN collections c ON c.id = p.collection_id
           LEFT JOIN categories cat ON cat.id = p.category_id
           LEFT JOIN orders o ON o.product_id = p.id
           GROUP BY p.id, c.name, cat.name
           ORDER BY p.created_at DESC
         ) p
        ),
        '[]'::json
      ),
      -- All categories with stats
      COALESCE(
        (SELECT json_agg(row_to_json(cat))
         FROM (
           SELECT 
             cat.*,
             c.name as collection_name,
             COUNT(p.id) as product_count
           FROM categories cat
           JOIN collections c ON c.id = cat.collection_id
           LEFT JOIN products p ON p.category_id = cat.id
           GROUP BY cat.id, c.name
           ORDER BY cat.created_at DESC
         ) cat
        ),
        '[]'::json
      ),
      -- All orders
      COALESCE(
        (SELECT json_agg(row_to_json(o))
         FROM (
           SELECT 
             o.*,
             p.name as product_name,
             c.name as collection_name
           FROM orders o
           JOIN products p ON p.id = o.product_id
           JOIN collections c ON c.id = p.collection_id
           ORDER BY o.created_at DESC
         ) o
        ),
        '[]'::json
      );
  ELSE
    -- For regular users, return only their accessible data
    RETURN QUERY
    SELECT
      -- User's collections and shared collections
      COALESCE(
        (SELECT json_agg(row_to_json(c))
         FROM (
           SELECT 
             c.*,
             COUNT(DISTINCT p.id) as product_count,
             COUNT(DISTINCT o.id) as order_count,
             CASE 
               WHEN c.user_id = auth.uid() THEN NULL
               WHEN ca.access_type IS NOT NULL THEN ca.access_type
               ELSE NULL
             END as access_type
           FROM collections c
           LEFT JOIN collection_access ca ON ca.collection_id = c.id AND ca.user_id = auth.uid()
           LEFT JOIN products p ON p.collection_id = c.id
           LEFT JOIN orders o ON o.product_id = p.id
           WHERE 
             c.user_id = auth.uid() OR
             ca.collection_id IS NOT NULL
           GROUP BY c.id, ca.access_type
           ORDER BY c.created_at DESC
         ) c
        ),
        '[]'::json
      ),
      -- User's products and shared products
      COALESCE(
        (SELECT json_agg(row_to_json(p))
         FROM (
           SELECT 
             p.*,
             c.name as collection_name,
             cat.name as category_name,
             COUNT(o.id) as order_count,
             CASE 
               WHEN c.user_id = auth.uid() THEN NULL
               WHEN ca.access_type IS NOT NULL THEN ca.access_type
               ELSE NULL
             END as access_type
           FROM products p
           JOIN collections c ON c.id = p.collection_id
           LEFT JOIN collection_access ca ON ca.collection_id = c.id AND ca.user_id = auth.uid()
           LEFT JOIN categories cat ON cat.id = p.category_id
           LEFT JOIN orders o ON o.product_id = p.id
           WHERE 
             c.user_id = auth.uid() OR
             ca.collection_id IS NOT NULL
           GROUP BY p.id, c.name, cat.name, ca.access_type
           ORDER BY p.created_at DESC
         ) p
        ),
        '[]'::json
      ),
      -- User's categories and shared categories
      COALESCE(
        (SELECT json_agg(row_to_json(cat))
         FROM (
           SELECT 
             cat.*,
             c.name as collection_name,
             COUNT(p.id) as product_count,
             CASE 
               WHEN c.user_id = auth.uid() THEN NULL
               WHEN ca.access_type IS NOT NULL THEN ca.access_type
               ELSE NULL
             END as access_type
           FROM categories cat
           JOIN collections c ON c.id = cat.collection_id
           LEFT JOIN collection_access ca ON ca.collection_id = c.id AND ca.user_id = auth.uid()
           LEFT JOIN products p ON p.category_id = cat.id
           WHERE 
             c.user_id = auth.uid() OR
             ca.collection_id IS NOT NULL
           GROUP BY cat.id, c.name, ca.access_type
           ORDER BY cat.created_at DESC
         ) cat
        ),
        '[]'::json
      ),
      -- User's orders
      COALESCE(
        (SELECT json_agg(row_to_json(o))
         FROM (
           SELECT 
             o.*,
             p.name as product_name,
             c.name as collection_name
           FROM orders o
           JOIN products p ON p.id = o.product_id
           JOIN collections c ON c.id = p.collection_id
           WHERE c.user_id = auth.uid()
           ORDER BY o.created_at DESC
         ) o
        ),
        '[]'::json
      );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT ON merchant_collections TO authenticated;
GRANT SELECT ON merchant_products TO authenticated;
GRANT SELECT ON merchant_categories TO authenticated;
GRANT EXECUTE ON FUNCTION get_merchant_collections() TO authenticated;
GRANT EXECUTE ON FUNCTION get_merchant_products(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_merchant_categories(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_merchant_dashboard_data(uuid) TO authenticated;

-- Verify changes
DO $$
BEGIN
  -- Check if views exist
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_views 
    WHERE viewname IN ('merchant_collections', 'merchant_products', 'merchant_categories')
  ) THEN
    RAISE EXCEPTION 'Views not created properly';
  END IF;

  -- Check if functions exist
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_proc 
    WHERE proname IN (
      'get_merchant_collections',
      'get_merchant_products',
      'get_merchant_categories',
      'get_merchant_dashboard_data'
    )
  ) THEN
    RAISE EXCEPTION 'Functions not created properly';
  END IF;
END $$;

COMMIT; 