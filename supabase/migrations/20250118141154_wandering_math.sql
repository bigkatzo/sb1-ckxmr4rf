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

-- Create indexes for faster joins
CREATE INDEX IF NOT EXISTS idx_products_collection_id ON products(collection_id);
CREATE INDEX IF NOT EXISTS idx_categories_collection_id ON categories(collection_id);
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);

-- Create helper function to check collection ownership
CREATE OR REPLACE FUNCTION auth.can_access_collection(collection_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM collections c
    WHERE c.id = collection_id
    AND (
      -- User owns collection
      c.user_id = auth.uid()
      OR 
      -- User is admin
      (SELECT email = 'admin420@merchant.local' FROM auth.users WHERE id = auth.uid())
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create simplified RLS policies
CREATE POLICY "products_access"
  ON products
  FOR ALL
  TO authenticated
  USING (auth.can_access_collection(collection_id))
  WITH CHECK (auth.can_access_collection(collection_id));

CREATE POLICY "categories_access"
  ON categories
  FOR ALL
  TO authenticated
  USING (auth.can_access_collection(collection_id))
  WITH CHECK (auth.can_access_collection(collection_id));

CREATE POLICY "orders_access"
  ON orders
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = orders.product_id
      AND auth.can_access_collection(p.collection_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = orders.product_id
      AND auth.can_access_collection(p.collection_id)
    )
  );

-- Create efficient function to get all merchant data
CREATE OR REPLACE FUNCTION get_merchant_data(p_user_id uuid)
RETURNS json AS $$
DECLARE
  v_result json;
BEGIN
  WITH collection_data AS (
    SELECT 
      c.id,
      c.name,
      c.description,
      c.image_url,
      c.launch_date,
      c.visible,
      c.featured,
      c.sale_ended,
      c.slug,
      COUNT(DISTINCT p.id) as product_count,
      COUNT(DISTINCT cat.id) as category_count,
      COUNT(DISTINCT o.id) as order_count
    FROM collections c
    LEFT JOIN products p ON p.collection_id = c.id
    LEFT JOIN categories cat ON cat.collection_id = c.id
    LEFT JOIN orders o ON o.product_id = p.id
    WHERE c.user_id = p_user_id
    GROUP BY c.id
  ),
  product_data AS (
    SELECT json_agg(p.*) as products
    FROM (
      SELECT 
        p.id,
        p.name,
        p.sku,
        p.description,
        p.price,
        p.quantity as stock,
        p.images,
        p.category_id,
        p.collection_id,
        c.name as collection_name,
        cat.name as category_name
      FROM products p
      JOIN collections c ON c.id = p.collection_id
      LEFT JOIN categories cat ON cat.id = p.category_id
      WHERE c.user_id = p_user_id
      ORDER BY p.created_at DESC
    ) p
  ),
  category_data AS (
    SELECT json_agg(cat.*) as categories
    FROM (
      SELECT 
        cat.id,
        cat.name,
        cat.description,
        cat.type,
        cat.collection_id,
        c.name as collection_name
      FROM categories cat
      JOIN collections c ON c.id = cat.collection_id
      WHERE c.user_id = p_user_id
      ORDER BY cat.created_at DESC
    ) cat
  ),
  order_data AS (
    SELECT json_agg(o.*) as orders
    FROM (
      SELECT 
        o.id,
        o.product_id,
        p.name as product_name,
        o.status,
        o.transaction_id,
        o.wallet_address,
        o.created_at
      FROM orders o
      JOIN products p ON p.id = o.product_id
      JOIN collections c ON c.id = p.collection_id
      WHERE c.user_id = p_user_id
      ORDER BY o.created_at DESC
    ) o
  )
  SELECT json_build_object(
    'collections', (SELECT json_agg(c.*) FROM collection_data c),
    'products', (SELECT products FROM product_data),
    'categories', (SELECT categories FROM category_data),
    'orders', (SELECT orders FROM order_data)
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT ALL ON products TO authenticated;
GRANT ALL ON categories TO authenticated;
GRANT ALL ON orders TO authenticated;
GRANT EXECUTE ON FUNCTION auth.can_access_collection(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_merchant_data(uuid) TO authenticated;