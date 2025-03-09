-- Create view for merchant dashboard products (includes all products with category data)
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

-- Grant access to authenticated users only (merchants)
GRANT SELECT ON merchant_products TO authenticated;

-- Create view for public storefront products (only visible collections)
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
WHERE c.visible = true;

-- Grant access to anonymous users (public storefront)
GRANT SELECT ON public_products_with_categories TO anon;

-- Update the best sellers function to use the new view and sort by sales
CREATE OR REPLACE FUNCTION public.get_best_sellers(p_limit integer DEFAULT 6, p_sort_by text DEFAULT 'sales')
RETURNS SETOF public_products_with_categories
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.* 
  FROM public_products_with_categories p
  LEFT JOIN public_order_counts oc ON p.id = oc.product_id
  WHERE p.collection_sale_ended = false
  ORDER BY 
    CASE 
      WHEN p_sort_by = 'sales' THEN COALESCE(oc.total_orders, 0)
      ELSE p.quantity 
    END DESC
  LIMIT p_limit;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_best_sellers(integer, text) TO anon; 