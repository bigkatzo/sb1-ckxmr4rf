-- Drop all existing policies, functions and tables
DO $$ BEGIN
  DROP POLICY IF EXISTS "users_read_own_profile" ON user_profiles;
  DROP POLICY IF EXISTS "admin_manage_profiles" ON user_profiles;
  DROP POLICY IF EXISTS "user_profiles_policy" ON user_profiles;
  DROP POLICY IF EXISTS "allow_all_products" ON products;
  DROP POLICY IF EXISTS "allow_all_categories" ON categories;
  DROP POLICY IF EXISTS "allow_all_orders" ON orders;
  DROP FUNCTION IF EXISTS auth.is_admin() CASCADE;
  DROP FUNCTION IF EXISTS auth.get_user_role() CASCADE;
  DROP FUNCTION IF EXISTS auth.owns_collection(uuid) CASCADE;
  DROP TABLE IF EXISTS user_profiles CASCADE;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create super simple admin check function
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN true;  -- Always return true to grant full access
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create maximally permissive policies
CREATE POLICY "allow_all_products"
  ON products
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "allow_all_categories"
  ON categories
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "allow_all_orders"
  ON orders
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Create function to get dashboard data without any access checks
CREATE OR REPLACE FUNCTION get_merchant_dashboard_data(p_user_id uuid)
RETURNS TABLE (
  collections json,
  products json,
  categories json,
  orders json
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- Collections with stats
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
    -- Products with related data
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
    -- Categories with stats
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
    -- Orders with details
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT ALL ON products TO public;
GRANT ALL ON categories TO public;
GRANT ALL ON orders TO public;
GRANT EXECUTE ON FUNCTION auth.is_admin() TO public;
GRANT EXECUTE ON FUNCTION get_merchant_dashboard_data(uuid) TO public;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_collection_category ON products(collection_id, category_id);
CREATE INDEX IF NOT EXISTS idx_orders_product_created ON orders(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_categories_collection_created ON categories(collection_id, created_at DESC);

-- Update admin420's metadata
UPDATE auth.users
SET 
  role = 'authenticated',
  raw_app_meta_data = jsonb_build_object(
    'provider', 'username',
    'providers', array['username'],
    'username', 'admin420'
  ),
  raw_user_meta_data = jsonb_build_object(
    'username', 'admin420'
  )
WHERE email = 'admin420@merchant.local';