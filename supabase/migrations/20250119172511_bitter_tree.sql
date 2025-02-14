-- Drop existing function
DROP FUNCTION IF EXISTS get_merchant_dashboard_data(uuid);

-- Create improved function that uses auth.uid() consistently
CREATE OR REPLACE FUNCTION get_merchant_dashboard_data(p_user_id uuid)
RETURNS TABLE (
  collections json,
  products json,
  categories json,
  orders json
) AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Use auth.uid() for consistency with RLS policies
  v_user_id := auth.uid();
  
  -- For admin, return all data
  IF auth.is_admin() THEN
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
      -- All orders with details
      COALESCE(
        (SELECT json_agg(row_to_json(o))
         FROM (
           SELECT 
             o.*,
             p.name as product_name,
             p.sku as product_sku,
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
    -- For regular users, return only their data
    RETURN QUERY
    SELECT
      -- User's collections with stats
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
           WHERE c.user_id = v_user_id
           GROUP BY c.id
           ORDER BY c.created_at DESC
         ) c
        ),
        '[]'::json
      ),
      -- User's products with related data
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
           WHERE c.user_id = v_user_id
           GROUP BY p.id, c.name, cat.name
           ORDER BY p.created_at DESC
         ) p
        ),
        '[]'::json
      ),
      -- User's categories with stats
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
           WHERE c.user_id = v_user_id
           GROUP BY cat.id, c.name
           ORDER BY cat.created_at DESC
         ) cat
        ),
        '[]'::json
      ),
      -- User's orders with details
      COALESCE(
        (SELECT json_agg(row_to_json(o))
         FROM (
           SELECT 
             o.*,
             p.name as product_name,
             p.sku as product_sku,
             c.name as collection_name
           FROM orders o
           JOIN products p ON p.id = o.product_id
           JOIN collections c ON c.id = p.collection_id
           WHERE c.user_id = v_user_id
           ORDER BY o.created_at DESC
         ) o
        ),
        '[]'::json
      );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_merchant_dashboard_data(uuid) TO authenticated;