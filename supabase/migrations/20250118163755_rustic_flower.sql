-- Drop existing policies first
DO $$ BEGIN
  DROP POLICY IF EXISTS "products_policy" ON products;
  DROP POLICY IF EXISTS "categories_policy" ON categories;
  DROP POLICY IF EXISTS "orders_policy" ON orders;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create super simple admin check function
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN current_setting('request.jwt.claims', true)::jsonb->>'email' = 'admin420@merchant.local';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create maximally permissive policies for admin
CREATE POLICY "products_policy"
  ON products
  FOR ALL
  TO authenticated
  USING (
    -- Admin can do anything
    auth.is_admin()
    OR
    -- Others can only access their own
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "categories_policy"
  ON categories
  FOR ALL
  TO authenticated
  USING (
    -- Admin can do anything
    auth.is_admin()
    OR
    -- Others can only access their own
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "orders_policy"
  ON orders
  FOR ALL
  TO authenticated
  USING (
    -- Admin can do anything
    auth.is_admin()
    OR
    -- Others can only access their own
    EXISTS (
      SELECT 1 FROM products p
      JOIN collections c ON c.id = p.collection_id
      WHERE p.id = orders.product_id
      AND c.user_id = auth.uid()
    )
  );

-- Enable RLS on all tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT ALL ON products TO authenticated;
GRANT ALL ON categories TO authenticated;
GRANT ALL ON orders TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated;

-- Create function to get merchant dashboard data
CREATE OR REPLACE FUNCTION get_merchant_dashboard_data(p_user_id uuid)
RETURNS TABLE (
  collections json,
  products json,
  categories json,
  orders json
) AS $$
BEGIN
  -- For admin, return all data
  IF auth.is_admin() THEN
    RETURN QUERY
    SELECT
      -- All collections
      COALESCE((SELECT json_agg(row_to_json(c)) FROM collections c ORDER BY c.created_at DESC), '[]'::json),
      -- All products
      COALESCE((SELECT json_agg(row_to_json(p)) FROM products p ORDER BY p.created_at DESC), '[]'::json),
      -- All categories
      COALESCE((SELECT json_agg(row_to_json(cat)) FROM categories cat ORDER BY cat.created_at DESC), '[]'::json),
      -- All orders
      COALESCE((SELECT json_agg(row_to_json(o)) FROM orders o ORDER BY o.created_at DESC), '[]'::json);
  ELSE
    -- For regular users, return only their data
    RETURN QUERY
    SELECT
      -- User's collections
      COALESCE(
        (SELECT json_agg(row_to_json(c))
         FROM collections c
         WHERE c.user_id = p_user_id
         ORDER BY c.created_at DESC),
        '[]'::json
      ),
      -- User's products
      COALESCE(
        (SELECT json_agg(row_to_json(p))
         FROM products p
         JOIN collections c ON c.id = p.collection_id
         WHERE c.user_id = p_user_id
         ORDER BY p.created_at DESC),
        '[]'::json
      ),
      -- User's categories
      COALESCE(
        (SELECT json_agg(row_to_json(cat))
         FROM categories cat
         JOIN collections c ON c.id = cat.collection_id
         WHERE c.user_id = p_user_id
         ORDER BY cat.created_at DESC),
        '[]'::json
      ),
      -- User's orders
      COALESCE(
        (SELECT json_agg(row_to_json(o))
         FROM orders o
         JOIN products p ON p.id = o.product_id
         JOIN collections c ON c.id = p.collection_id
         WHERE c.user_id = p_user_id
         ORDER BY o.created_at DESC),
        '[]'::json
      );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_merchant_dashboard_data(uuid) TO authenticated;