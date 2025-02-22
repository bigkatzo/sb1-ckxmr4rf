-- Drop existing function
DROP FUNCTION IF EXISTS get_merchant_orders(int, int);

-- Create updated function with fixed array access
CREATE OR REPLACE FUNCTION get_merchant_orders(
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  product_name text,
  product_sku text,
  product_price numeric,
  product_image text,
  collection_id uuid,
  collection_name text,
  category_name text,
  variants jsonb,
  shipping_info jsonb,
  transaction_id text,
  transaction_status text,
  wallet_address text,
  status text,
  created_at timestamptz,
  updated_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    p.name as product_name,
    p.sku as product_sku,
    p.price as product_price,
    COALESCE(
      (SELECT unnest(p.images) LIMIT 1),
      NULL
    ) as product_image,
    c.id as collection_id,
    c.name as collection_name,
    cat.name as category_name,
    o.variants,
    o.shipping_info,
    o.transaction_id,
    o.transaction_status,
    o.wallet_address,
    o.status,
    o.created_at,
    o.updated_at
  FROM orders o
  JOIN products p ON p.id = o.product_id
  JOIN collections c ON c.id = p.collection_id
  LEFT JOIN categories cat ON cat.id = p.category_id
  LEFT JOIN collection_access ca ON ca.collection_id = c.id AND ca.user_id = auth.uid()
  WHERE c.user_id = auth.uid() OR ca.access_type IN ('view', 'edit')
  ORDER BY o.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;