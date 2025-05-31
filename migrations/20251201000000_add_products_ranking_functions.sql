-- Add functions for product rankings page - PURELY ADDITIVE APPROACH
BEGIN;

-- Create a new materialized view specifically for time-based rankings
-- This doesn't modify any existing view and is completely additive
CREATE MATERIALIZED VIEW IF NOT EXISTS public_trending_products AS
WITH date_ranges AS (
  SELECT
    CURRENT_DATE as today_start,
    CURRENT_DATE - INTERVAL '7 days' as week_start,
    CURRENT_DATE - INTERVAL '30 days' as month_start
),
filtered_orders AS (
  SELECT
    o.product_id,
    o.created_at,
    o.status
  FROM orders o
  JOIN products p ON p.id = o.product_id
  JOIN collections c ON c.id = p.collection_id
  WHERE 
    o.status IN ('confirmed', 'preparing', 'shipped', 'delivered')
    AND c.visible = true
    AND o.created_at >= (SELECT month_start FROM date_ranges)
)
SELECT 
  p.id AS product_id,
  -- Use existing public_order_counts for all_time to avoid counting twice
  COALESCE(pc.total_orders, 0) AS all_time_orders,
  -- Count for today
  COALESCE((
    SELECT COUNT(*)
    FROM filtered_orders fo
    WHERE fo.product_id = p.id
    AND fo.created_at >= (SELECT today_start FROM date_ranges)
  ), 0) AS today_orders,
  -- Count for last 7 days
  COALESCE((
    SELECT COUNT(*)
    FROM filtered_orders fo
    WHERE fo.product_id = p.id
    AND fo.created_at >= (SELECT week_start FROM date_ranges)
  ), 0) AS last_7_days_orders,
  -- Count for last 30 days
  COALESCE((
    SELECT COUNT(*)
    FROM filtered_orders fo
    WHERE fo.product_id = p.id
  ), 0) AS last_30_days_orders,
  -- Include visibility info for efficient filtering
  (c.sale_ended IS NULL OR c.sale_ended = false) AND
  (cat.sale_ended IS NULL OR cat.sale_ended = false) AND
  (p.sale_ended IS NULL OR p.sale_ended = false) AS is_active
FROM products p
LEFT JOIN public_order_counts pc ON p.id = pc.product_id
JOIN collections c ON c.id = p.collection_id
LEFT JOIN categories cat ON cat.id = p.category_id
WHERE c.visible = true;

-- Create indexes on the materialized view for better performance
CREATE UNIQUE INDEX IF NOT EXISTS public_trending_products_product_id_idx ON public_trending_products(product_id);
CREATE INDEX IF NOT EXISTS public_trending_products_all_time_idx ON public_trending_products(all_time_orders DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS public_trending_products_today_idx ON public_trending_products(today_orders DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS public_trending_products_last_7_days_idx ON public_trending_products(last_7_days_orders DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS public_trending_products_last_30_days_idx ON public_trending_products(last_30_days_orders DESC) WHERE is_active = true;

-- Add function to refresh the materialized view (can be scheduled to run periodically)
CREATE OR REPLACE FUNCTION refresh_trending_products()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Use concurrent refresh to avoid locking
  REFRESH MATERIALIZED VIEW CONCURRENTLY public_trending_products;
EXCEPTION 
  WHEN OTHERS THEN
    -- Log error but don't fail
    RAISE WARNING 'Error refreshing trending products view: %', SQLERRM;
END;
$$;

-- Create function for ranked products by time period - DOES NOT MODIFY existing get_best_sellers
CREATE OR REPLACE FUNCTION public.get_trending_products(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_time_period text DEFAULT 'all_time'
)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  price numeric,
  images text[],
  design_files text[],
  quantity integer,
  minimum_order_quantity integer,
  category_id uuid,
  collection_id uuid,
  variants jsonb,
  variant_prices jsonb,
  slug text,
  visible boolean,
  sale_ended boolean,
  pin_order integer,
  blank_code text,
  technique text,
  note_for_supplier text,
  collection_name text,
  collection_slug text,
  collection_launch_date timestamptz,
  collection_sale_ended boolean,
  category_name text,
  category_description text,
  category_type text,
  category_eligibility_rules jsonb,
  category_sale_ended boolean,
  shipping_notes text,
  quality_notes text,
  returns_notes text,
  free_notes text,
  price_modifier_before_min numeric,
  price_modifier_after_min numeric,
  sales_count integer,
  order_count bigint,
  rank bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ranked_products AS (
    SELECT 
      p.id,
      CASE 
        WHEN p_time_period = 'today' THEN tp.today_orders
        WHEN p_time_period = 'last_7_days' THEN tp.last_7_days_orders
        WHEN p_time_period = 'last_30_days' THEN tp.last_30_days_orders
        ELSE tp.all_time_orders
      END AS order_count,
      ROW_NUMBER() OVER (
        ORDER BY
          CASE 
            WHEN p_time_period = 'today' THEN tp.today_orders
            WHEN p_time_period = 'last_7_days' THEN tp.last_7_days_orders
            WHEN p_time_period = 'last_30_days' THEN tp.last_30_days_orders
            ELSE tp.all_time_orders
          END DESC,
          p.id
      ) AS rank
    FROM public_products_with_categories p
    JOIN public_trending_products tp ON p.id = tp.product_id
    WHERE tp.is_active = true
  )
  SELECT 
    p.*,
    rp.order_count,
    rp.rank
  FROM public_products_with_categories p
  JOIN ranked_products rp ON p.id = rp.id
  WHERE rp.rank > p_offset AND rp.rank <= (p_offset + p_limit)
  ORDER BY rp.rank;
$$;

-- Function to get products ranked by launch date (newest first)
CREATE OR REPLACE FUNCTION public.get_products_by_launch_date(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  price numeric,
  images text[],
  design_files text[],
  quantity integer,
  minimum_order_quantity integer,
  category_id uuid,
  collection_id uuid,
  variants jsonb,
  variant_prices jsonb,
  slug text,
  visible boolean,
  sale_ended boolean,
  pin_order integer,
  blank_code text,
  technique text,
  note_for_supplier text,
  collection_name text,
  collection_slug text,
  collection_launch_date timestamptz,
  collection_sale_ended boolean,
  category_name text,
  category_description text,
  category_type text,
  category_eligibility_rules jsonb,
  category_sale_ended boolean,
  shipping_notes text,
  quality_notes text,
  returns_notes text,
  free_notes text,
  price_modifier_before_min numeric,
  price_modifier_after_min numeric,
  sales_count integer,
  rank bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ranked_products AS (
    SELECT 
      p.id,
      ROW_NUMBER() OVER (
        ORDER BY p.collection_launch_date DESC, p.id
      ) AS rank
    FROM public_products_with_categories p
    WHERE (p.collection_sale_ended = false OR p.collection_sale_ended IS NULL)
      AND (p.category_sale_ended = false OR p.category_sale_ended IS NULL)
      AND (p.sale_ended = false OR p.sale_ended IS NULL)
  )
  SELECT 
    p.*,
    rp.rank
  FROM public_products_with_categories p
  JOIN ranked_products rp ON p.id = rp.id
  WHERE rp.rank > p_offset AND rp.rank <= (p_offset + p_limit)
  ORDER BY rp.rank;
$$;

-- Initial refresh of the materialized view
SELECT refresh_trending_products();

-- Grant necessary permissions
GRANT SELECT ON public_trending_products TO anon;
GRANT EXECUTE ON FUNCTION public.get_trending_products(integer, integer, text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_products_by_launch_date(integer, integer) TO anon;
GRANT EXECUTE ON FUNCTION refresh_trending_products() TO postgres;

-- Add comments
COMMENT ON MATERIALIZED VIEW public_trending_products IS 'Pre-calculated order counts for different time periods to support the trending products page';
COMMENT ON FUNCTION public.get_trending_products(integer, integer, text) IS 'Returns products ranked by sales count for specified time period (today, last_7_days, last_30_days, all_time)';
COMMENT ON FUNCTION public.get_products_by_launch_date(integer, integer) IS 'Returns products ranked by launch date (newest first)';
COMMENT ON FUNCTION refresh_trending_products() IS 'Refreshes the materialized view of trending products';

COMMIT; 