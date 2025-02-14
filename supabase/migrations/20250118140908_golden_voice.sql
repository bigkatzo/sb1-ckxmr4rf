-- Drop existing policies first
DO $$ BEGIN
  DROP POLICY IF EXISTS "products_access" ON products;
  DROP POLICY IF EXISTS "categories_access" ON categories;
  DROP POLICY IF EXISTS "orders_access" ON orders;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Enable RLS on all tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Create simplified policies for products
CREATE POLICY "products_access"
  ON products
  FOR ALL
  TO authenticated
  USING (
    -- Admin can do anything
    (SELECT email = 'admin420@merchant.local' FROM auth.users WHERE id = auth.uid())
    OR
    -- Collection owners can access their products
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND c.user_id = auth.uid()
    )
  );

-- Create simplified policies for categories
CREATE POLICY "categories_access"
  ON categories
  FOR ALL
  TO authenticated
  USING (
    -- Admin can do anything
    (SELECT email = 'admin420@merchant.local' FROM auth.users WHERE id = auth.uid())
    OR
    -- Collection owners can access their categories
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = categories.collection_id
      AND c.user_id = auth.uid()
    )
  );

-- Create simplified policies for orders
CREATE POLICY "orders_access"
  ON orders
  FOR ALL
  TO authenticated
  USING (
    -- Admin can do anything
    (SELECT email = 'admin420@merchant.local' FROM auth.users WHERE id = auth.uid())
    OR
    -- Collection owners can access orders for their products
    EXISTS (
      SELECT 1 FROM products p
      JOIN collections c ON c.id = p.collection_id
      WHERE p.id = orders.product_id
      AND c.user_id = auth.uid()
    )
  );

-- Create function to get merchant dashboard data
CREATE OR REPLACE FUNCTION get_merchant_dashboard_data(p_user_id uuid)
RETURNS TABLE (
  collection_count bigint,
  product_count bigint,
  category_count bigint,
  order_count bigint,
  collections json,
  products json,
  categories json,
  orders json
) AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT
      COUNT(DISTINCT c.id) as collection_count,
      COUNT(DISTINCT p.id) as product_count,
      COUNT(DISTINCT cat.id) as category_count,
      COUNT(DISTINCT o.id) as order_count,
      COALESCE(json_agg(
        json_build_object(
          'id', c.id,
          'name', c.name,
          'description', c.description,
          'imageUrl', c.image_url,
          'launchDate', c.launch_date,
          'visible', c.visible,
          'featured', c.featured,
          'saleEnded', c.sale_ended,
          'slug', c.slug
        ) ORDER BY c.created_at DESC
      ) FILTER (WHERE c.id IS NOT NULL), '[]'::json) as collections,
      COALESCE(json_agg(
        json_build_object(
          'id', p.id,
          'name', p.name,
          'sku', p.sku,
          'description', p.description,
          'price', p.price,
          'stock', p.quantity,
          'images', p.images,
          'categoryId', p.category_id,
          'collectionId', p.collection_id
        ) ORDER BY p.created_at DESC
      ) FILTER (WHERE p.id IS NOT NULL), '[]'::json) as products,
      COALESCE(json_agg(
        json_build_object(
          'id', cat.id,
          'name', cat.name,
          'description', cat.description,
          'type', cat.type,
          'collectionId', cat.collection_id
        ) ORDER BY cat.created_at DESC
      ) FILTER (WHERE cat.id IS NOT NULL), '[]'::json) as categories,
      COALESCE(json_agg(
        json_build_object(
          'id', o.id,
          'productId', o.product_id,
          'status', o.status,
          'transactionId', o.transaction_id,
          'walletAddress', o.wallet_address,
          'createdAt', o.created_at
        ) ORDER BY o.created_at DESC
      ) FILTER (WHERE o.id IS NOT NULL), '[]'::json) as orders
    FROM collections c
    LEFT JOIN products p ON p.collection_id = c.id
    LEFT JOIN categories cat ON cat.collection_id = c.id
    LEFT JOIN orders o ON o.product_id = p.id
    WHERE c.user_id = p_user_id
  )
  SELECT * FROM stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT ALL ON products TO authenticated;
GRANT ALL ON categories TO authenticated;
GRANT ALL ON orders TO authenticated;
GRANT EXECUTE ON FUNCTION get_merchant_dashboard_data(uuid) TO authenticated;