-- Create function to get merchant collections with stats
CREATE OR REPLACE FUNCTION get_merchant_collections(
  p_user_id uuid,
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  image_url text,
  launch_date timestamptz,
  visible boolean,
  featured boolean,
  sale_ended boolean,
  slug text,
  product_count bigint,
  category_count bigint,
  order_count bigint
) AS $$
BEGIN
  RETURN QUERY
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
  ORDER BY c.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get merchant products
CREATE OR REPLACE FUNCTION get_merchant_products(
  p_user_id uuid,
  p_collection_id uuid DEFAULT NULL,
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  name text,
  sku text,
  description text,
  price numeric,
  stock integer,
  category_id uuid,
  collection_id uuid,
  collection_name text,
  category_name text,
  images text[],
  variants jsonb,
  variant_prices jsonb,
  order_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.sku,
    p.description,
    p.price,
    p.quantity as stock,
    p.category_id,
    p.collection_id,
    c.name as collection_name,
    cat.name as category_name,
    p.images,
    p.variants,
    p.variant_prices,
    COUNT(DISTINCT o.id) as order_count
  FROM products p
  JOIN collections c ON c.id = p.collection_id
  LEFT JOIN categories cat ON cat.id = p.category_id
  LEFT JOIN orders o ON o.product_id = p.id
  WHERE c.user_id = p_user_id
  AND (p_collection_id IS NULL OR p.collection_id = p_collection_id)
  GROUP BY p.id, c.name, cat.name
  ORDER BY p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get merchant categories
CREATE OR REPLACE FUNCTION get_merchant_categories(
  p_user_id uuid,
  p_collection_id uuid DEFAULT NULL,
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  type text,
  collection_id uuid,
  collection_name text,
  product_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cat.id,
    cat.name,
    cat.description,
    cat.type,
    cat.collection_id,
    c.name as collection_name,
    COUNT(DISTINCT p.id) as product_count
  FROM categories cat
  JOIN collections c ON c.id = cat.collection_id
  LEFT JOIN products p ON p.category_id = cat.id
  WHERE c.user_id = p_user_id
  AND (p_collection_id IS NULL OR cat.collection_id = p_collection_id)
  GROUP BY cat.id, c.name
  ORDER BY cat.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_merchant_collections(uuid, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION get_merchant_products(uuid, uuid, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION get_merchant_categories(uuid, uuid, int, int) TO authenticated;