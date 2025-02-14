-- Drop existing function first
DROP FUNCTION IF EXISTS get_merchant_dashboard_data(uuid);

-- Drop existing policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "products_access" ON products;
  DROP POLICY IF EXISTS "categories_access" ON categories;
  DROP POLICY IF EXISTS "orders_access" ON orders;
  DROP POLICY IF EXISTS "products_policy" ON products;
  DROP POLICY IF EXISTS "categories_policy" ON categories;
  DROP POLICY IF EXISTS "orders_policy" ON orders;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create simplified admin check function
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN current_setting('request.jwt.claims', true)::jsonb->>'email' = 'admin420@merchant.local';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user owns collection
CREATE OR REPLACE FUNCTION auth.owns_collection(collection_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM collections
    WHERE id = collection_id
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create maximally permissive RLS policies
CREATE POLICY "products_policy"
  ON products
  FOR ALL
  TO authenticated
  USING (
    -- Public access to products in visible collections
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND c.visible = true
    )
    OR
    -- Collection owners can access their products
    auth.owns_collection(collection_id)
    OR
    -- Admins can access everything
    auth.is_admin()
  );

CREATE POLICY "categories_policy"
  ON categories
  FOR ALL
  TO authenticated
  USING (
    -- Public access to categories in visible collections
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND c.visible = true
    )
    OR
    -- Collection owners can access their categories
    auth.owns_collection(collection_id)
    OR
    -- Admins can access everything
    auth.is_admin()
  );

CREATE POLICY "orders_policy"
  ON orders
  FOR ALL
  TO authenticated
  USING (
    -- Buyers can see their own orders
    wallet_address = auth.jwt()->>'wallet_address'
    OR
    -- Collection owners can see orders for their products
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = orders.product_id
      AND auth.owns_collection(p.collection_id)
    )
    OR
    -- Admins can see everything
    auth.is_admin()
  );

-- Create function to get merchant dashboard data
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
    -- Collections
    COALESCE(
      (SELECT json_agg(row_to_json(c))
       FROM (
         SELECT c.*, COUNT(p.id) as product_count
         FROM collections c
         LEFT JOIN products p ON p.collection_id = c.id
         WHERE c.user_id = p_user_id
         GROUP BY c.id
         ORDER BY c.created_at DESC
       ) c
      ),
      '[]'::json
    ) as collections,
    
    -- Products
    COALESCE(
      (SELECT json_agg(row_to_json(p))
       FROM (
         SELECT p.*, c.name as collection_name, cat.name as category_name
         FROM products p
         JOIN collections c ON c.id = p.collection_id
         LEFT JOIN categories cat ON cat.id = p.category_id
         WHERE c.user_id = p_user_id
         ORDER BY p.created_at DESC
       ) p
      ),
      '[]'::json
    ) as products,
    
    -- Categories
    COALESCE(
      (SELECT json_agg(row_to_json(cat))
       FROM (
         SELECT cat.*, c.name as collection_name
         FROM categories cat
         JOIN collections c ON c.id = cat.collection_id
         WHERE c.user_id = p_user_id
         ORDER BY cat.created_at DESC
       ) cat
      ),
      '[]'::json
    ) as categories,
    
    -- Orders
    COALESCE(
      (SELECT json_agg(row_to_json(o))
       FROM (
         SELECT o.*, p.name as product_name, p.sku as product_sku
         FROM orders o
         JOIN products p ON p.id = o.product_id
         JOIN collections c ON c.id = p.collection_id
         WHERE c.user_id = p_user_id
         ORDER BY o.created_at DESC
       ) o
      ),
      '[]'::json
    ) as orders;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT ALL ON products TO authenticated;
GRANT ALL ON categories TO authenticated;
GRANT ALL ON orders TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.owns_collection(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_merchant_dashboard_data(uuid) TO authenticated;