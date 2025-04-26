-- Start transaction
BEGIN;

-- Drop existing functions
DROP FUNCTION IF EXISTS public.get_best_sellers(integer, text);
DROP FUNCTION IF EXISTS public.get_best_sellers_v2(integer, text);

-- Recreate the function to use public_order_counts view
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

-- Recreate the v2 function to also use public_order_counts view
CREATE OR REPLACE FUNCTION public.get_best_sellers_v2(limit_count integer DEFAULT 10, collection_slug text DEFAULT NULL)
RETURNS SETOF public_products_with_categories
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.*
  FROM public_products_with_categories p
  LEFT JOIN public_order_counts oc ON p.id = oc.product_id
  WHERE (collection_slug IS NULL OR p.collection_slug = collection_slug)
    AND p.collection_launch_date <= NOW()
    AND NOT p.collection_sale_ended
  ORDER BY COALESCE(oc.total_orders, 0) DESC, p.collection_launch_date DESC
  LIMIT limit_count;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_best_sellers(integer, text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_best_sellers_v2(integer, text) TO anon;

-- Update comments
COMMENT ON FUNCTION public.get_best_sellers(integer, text) IS 'Returns best-selling products from visible collections with active sales, sorted by validated orders (confirmed, shipped, delivered)';
COMMENT ON FUNCTION public.get_best_sellers_v2(integer, text) IS 'Returns best-selling products for a specific collection, sorted by validated orders (confirmed, shipped, delivered)';

COMMIT; 