-- Fix missing get_best_sellers function
BEGIN;

-- Drop existing function if it exists (to avoid errors when rerunning)
DROP FUNCTION IF EXISTS public.get_best_sellers(integer, text);

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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_best_sellers(integer, text) TO anon;

-- Update comments
COMMENT ON FUNCTION public.get_best_sellers(integer, text) IS 'Returns best-selling products from visible collections with active sales, sorted by validated orders (confirmed, preparing, shipped, delivered)';

COMMIT; 