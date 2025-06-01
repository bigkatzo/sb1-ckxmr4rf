-- Add function to count products for pagination
BEGIN;

-- Function to count products by launch date with the same filters as get_products_by_launch_date
CREATE OR REPLACE FUNCTION public.count_products_by_launch_date()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)
  FROM public_products_with_categories p
  WHERE (p.collection_sale_ended = false OR p.collection_sale_ended IS NULL)
    AND (p.category_sale_ended = false OR p.category_sale_ended IS NULL)
    AND (p.sale_ended = false OR p.sale_ended IS NULL)
    AND p.visible = true;
$$;

-- Function to count trending products with the same filters as get_trending_products
CREATE OR REPLACE FUNCTION public.count_trending_products(p_time_period text DEFAULT 'all_time')
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)
  FROM public_trending_products tp
  WHERE tp.is_active = true
  AND CASE 
    WHEN p_time_period = 'today' THEN tp.today_orders > 0
    WHEN p_time_period = 'last_7_days' THEN tp.last_7_days_orders > 0
    WHEN p_time_period = 'last_30_days' THEN tp.last_30_days_orders > 0
    ELSE true -- all_time doesn't filter by orders
  END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.count_products_by_launch_date() TO anon;
GRANT EXECUTE ON FUNCTION public.count_trending_products(text) TO anon;

COMMIT; 