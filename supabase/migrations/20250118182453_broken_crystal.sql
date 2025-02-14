-- Drop all existing policies and functions
DO $$ BEGIN
  DROP POLICY IF EXISTS "products_policy" ON products;
  DROP POLICY IF EXISTS "categories_policy" ON categories;
  DROP POLICY IF EXISTS "orders_policy" ON orders;
  DROP FUNCTION IF EXISTS auth.is_admin() CASCADE;
  DROP FUNCTION IF EXISTS auth.get_user_role() CASCADE;
  DROP FUNCTION IF EXISTS auth.owns_collection(uuid) CASCADE;
  DROP TABLE IF EXISTS user_profiles CASCADE;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Enable RLS on all tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Create maximally permissive policies that allow everything
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

-- Create function to get all dashboard data without any checks
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
    -- All collections
    COALESCE(
      (SELECT json_agg(row_to_json(c) ORDER BY c.created_at DESC)
       FROM collections c),
      '[]'::json
    ),
    -- All products
    COALESCE(
      (SELECT json_agg(row_to_json(p) ORDER BY p.created_at DESC)
       FROM products p),
      '[]'::json
    ),
    -- All categories
    COALESCE(
      (SELECT json_agg(row_to_json(cat) ORDER BY cat.created_at DESC)
       FROM categories cat),
      '[]'::json
    ),
    -- All orders
    COALESCE(
      (SELECT json_agg(row_to_json(o) ORDER BY o.created_at DESC)
       FROM orders o),
      '[]'::json
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant all permissions to authenticated users
GRANT ALL ON products TO authenticated;
GRANT ALL ON categories TO authenticated;
GRANT ALL ON orders TO authenticated;
GRANT EXECUTE ON FUNCTION get_merchant_dashboard_data(uuid) TO authenticated;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_categories_created_at ON categories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);