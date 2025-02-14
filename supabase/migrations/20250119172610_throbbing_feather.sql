-- Create function to check product access
CREATE OR REPLACE FUNCTION debug_product_access(p_user_id uuid)
RETURNS TABLE (
  has_access boolean,
  reason text
) AS $$
BEGIN
  -- Check if user is admin
  IF auth.is_admin() THEN
    RETURN QUERY
    SELECT true, 'User is admin';
    RETURN;
  END IF;

  -- Check if user owns any collections
  IF EXISTS (
    SELECT 1 FROM collections 
    WHERE user_id = p_user_id
  ) THEN
    RETURN QUERY
    SELECT true, 'User owns collections';
    RETURN;
  END IF;

  RETURN QUERY
  SELECT false, 'No access found';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing policies
DROP POLICY IF EXISTS "products_policy" ON products;

-- Create simplified product policy
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
  )
  WITH CHECK (
    -- Admin can do anything
    auth.is_admin()
    OR
    -- Collection owners can modify their products
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = products.collection_id
      AND c.user_id = auth.uid()
    )
  );

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Create function to get products for dashboard
CREATE OR REPLACE FUNCTION get_merchant_products(p_user_id uuid)
RETURNS json AS $$
DECLARE
  v_user_id uuid;
  v_is_admin boolean;
BEGIN
  -- Get current user ID and admin status
  v_user_id := auth.uid();
  v_is_admin := auth.is_admin();
  
  -- Return products based on access
  RETURN (
    SELECT json_agg(row_to_json(p))
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
      WHERE 
        v_is_admin  -- Admin sees all
        OR c.user_id = v_user_id  -- User sees own
      GROUP BY p.id, c.name, cat.name
      ORDER BY p.created_at DESC
    ) p
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION debug_product_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_merchant_products(uuid) TO authenticated;