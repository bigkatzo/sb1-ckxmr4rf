-- Drop and recreate views with CASCADE to handle dependencies
DROP VIEW IF EXISTS merchant_products CASCADE;
DROP VIEW IF EXISTS public_products CASCADE;
DROP VIEW IF EXISTS public_products_with_categories CASCADE;

-- Create merchant products view (includes all products, visible or not)
CREATE VIEW merchant_products AS
SELECT 
  p.id,
  p.name,
  p.sku,
  p.description,
  p.price,
  p.images,
  p.quantity,
  p.minimum_order_quantity,
  p.category_id,
  p.variants,
  p.variant_prices,
  p.slug,
  p.price_modifier_before_min,
  p.price_modifier_after_min,
  p.visible,
  c.id as collection_id,
  c.name as collection_name,
  c.slug as collection_slug,
  c.launch_date as collection_launch_date,
  c.sale_ended as collection_sale_ended,
  cat.name as category_name,
  cat.description as category_description,
  cat.type as category_type,
  cat.eligibility_rules as category_eligibility_rules
FROM products p
JOIN collections c ON c.id = p.collection_id
LEFT JOIN categories cat ON cat.id = p.category_id;

-- Create public products view (only visible products in visible collections)
CREATE VIEW public_products AS
SELECT 
  p.id,
  p.name,
  p.description,
  p.price,
  p.images,
  p.quantity,
  p.minimum_order_quantity,
  p.category_id,
  p.variants,
  p.variant_prices,
  p.slug,
  p.price_modifier_before_min,
  p.price_modifier_after_min,
  c.id as collection_id,
  c.name as collection_name,
  c.slug as collection_slug,
  c.launch_date as collection_launch_date,
  c.sale_ended as collection_sale_ended
FROM products p
JOIN collections c ON c.id = p.collection_id
LEFT JOIN categories cat ON cat.id = p.category_id
WHERE c.visible = true 
  AND p.visible = true
  AND (cat.id IS NULL OR cat.visible = true);

-- Create public products with categories view (only visible products in visible collections)
CREATE VIEW public_products_with_categories AS
SELECT 
  p.id,
  p.name,
  p.sku,
  p.description,
  p.price,
  p.images,
  p.quantity,
  p.minimum_order_quantity,
  p.category_id,
  p.variants,
  p.variant_prices,
  p.slug,
  p.price_modifier_before_min,
  p.price_modifier_after_min,
  c.id as collection_id,
  c.name as collection_name,
  c.slug as collection_slug,
  c.launch_date as collection_launch_date,
  c.sale_ended as collection_sale_ended,
  cat.name as category_name,
  cat.description as category_description,
  cat.type as category_type,
  cat.eligibility_rules as category_eligibility_rules
FROM products p
JOIN collections c ON c.id = p.collection_id
LEFT JOIN categories cat ON cat.id = p.category_id
WHERE c.visible = true 
  AND p.visible = true
  AND (cat.id IS NULL OR cat.visible = true);

-- Recreate the get_merchant_products function to maintain dependencies
CREATE OR REPLACE FUNCTION get_merchant_products(merchant_id uuid)
RETURNS SETOF merchant_products AS $$
BEGIN
  RETURN QUERY
  SELECT mp.*
  FROM merchant_products mp
  JOIN collection_merchants cm ON cm.collection_id = mp.collection_id
  WHERE cm.merchant_id = $1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old best sellers functions to maintain dependencies
DROP FUNCTION IF EXISTS get_best_sellers(integer);
DROP FUNCTION IF EXISTS get_best_sellers(integer, text);
DROP FUNCTION IF EXISTS get_best_sellers(integer, text, text);

-- Create best sellers function with original signature
CREATE OR REPLACE FUNCTION get_best_sellers(p_limit integer DEFAULT 6, p_sort_by text DEFAULT 'sales')
RETURNS SETOF public_products_with_categories AS $$
BEGIN
  RETURN QUERY
  SELECT p.*
  FROM public_products_with_categories p
  LEFT JOIN (
    SELECT product_id, COUNT(*) as order_count
    FROM orders
    GROUP BY product_id
  ) o ON o.product_id = p.id
  WHERE p.collection_launch_date <= NOW()
    AND NOT p.collection_sale_ended
  ORDER BY 
    CASE 
      WHEN p_sort_by = 'sales' THEN COALESCE(o.order_count, 0)
      ELSE p.quantity 
    END DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create best sellers function with new signature (for future use)
CREATE OR REPLACE FUNCTION get_best_sellers_v2(limit_count integer DEFAULT 10, collection_slug text DEFAULT NULL)
RETURNS SETOF public_products_with_categories AS $$
BEGIN
  RETURN QUERY
  SELECT p.*
  FROM public_products_with_categories p
  LEFT JOIN (
    SELECT product_id, COUNT(*) as order_count
    FROM orders
    GROUP BY product_id
  ) o ON o.product_id = p.id
  WHERE (collection_slug IS NULL OR p.collection_slug = collection_slug)
    AND p.collection_launch_date <= NOW()
    AND NOT p.collection_sale_ended
  ORDER BY COALESCE(o.order_count, 0) DESC, p.collection_launch_date DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT ON merchant_products TO authenticated;
GRANT SELECT ON public_products TO anon;
GRANT SELECT ON public_products_with_categories TO anon;
GRANT EXECUTE ON FUNCTION get_merchant_products(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_best_sellers(integer, text) TO anon;
GRANT EXECUTE ON FUNCTION get_best_sellers_v2(integer, text) TO anon; 