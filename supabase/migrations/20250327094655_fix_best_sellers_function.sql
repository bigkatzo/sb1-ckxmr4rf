-- Drop existing function
DROP FUNCTION IF EXISTS public.get_best_sellers(integer, text);

-- Create the fixed function
CREATE OR REPLACE FUNCTION public.get_best_sellers(p_limit integer DEFAULT 6, p_sort_by text DEFAULT 'sales')
RETURNS SETOF public_products_with_categories
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.* 
  FROM public_products_with_categories p
  LEFT JOIN (
    SELECT product_id, COUNT(*) as total_orders
    FROM orders
    GROUP BY product_id
  ) oc ON p.id = oc.product_id
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

-- Update comment
COMMENT ON FUNCTION public.get_best_sellers(integer, text) IS 'Returns best-selling products from visible collections with active sales, sorted by actual sales data'; 