-- Drop existing policies first
DO $$ BEGIN
  DROP POLICY IF EXISTS "products_policy" ON products;
  DROP POLICY IF EXISTS "categories_policy" ON categories;
  DROP POLICY IF EXISTS "orders_policy" ON orders;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Enable RLS on all tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for products
CREATE POLICY "products_policy"
  ON products
  FOR ALL
  TO authenticated
  USING (
    -- Admin can do anything
    auth.is_admin()
    OR
    -- Collection owners can access their products
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND c.user_id = auth.uid()
    )
  );

-- Create RLS policies for categories
CREATE POLICY "categories_policy"
  ON categories
  FOR ALL
  TO authenticated
  USING (
    -- Admin can do anything
    auth.is_admin()
    OR
    -- Collection owners can access their categories
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND c.user_id = auth.uid()
    )
  );

-- Create RLS policies for orders
CREATE POLICY "orders_policy"
  ON orders
  FOR ALL
  TO authenticated
  USING (
    -- Admin can do anything
    auth.is_admin()
    OR
    -- Collection owners can access orders for their products
    EXISTS (
      SELECT 1 FROM products p
      JOIN collections c ON c.id = p.collection_id
      WHERE p.id = orders.product_id
      AND c.user_id = auth.uid()
    )
  );

-- Create function to get merchant dashboard data with proper access checks
CREATE OR REPLACE FUNCTION get_merchant_dashboard_data(p_user_id uuid)
RETURNS TABLE (
  collections json,
  products json,
  categories json,
  orders json
) AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  -- Check if user is admin
  SELECT auth.is_admin() INTO v_is_admin;

  -- For admin, return all data
  IF v_is_admin THEN
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
           WHERE c.user_id = p_user_id
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
           WHERE c.user_id = p_user_id
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
           WHERE c.user_id = p_user_id
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
           WHERE c.user_id = p_user_id
           ORDER BY o.created_at DESC
         ) o
        ),
        '[]'::json
      );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT ALL ON products TO authenticated;
GRANT ALL ON categories TO authenticated;
GRANT ALL ON orders TO authenticated;
GRANT EXECUTE ON FUNCTION get_merchant_dashboard_data(uuid) TO authenticated;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_collection_category ON products(collection_id, category_id);
CREATE INDEX IF NOT EXISTS idx_orders_product_created ON orders(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_categories_collection_created ON categories(collection_id, created_at DESC);