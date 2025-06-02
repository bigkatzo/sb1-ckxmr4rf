-- Fix get_trending_products function type mismatch with free_notes
BEGIN;

-- Drop the existing function (if it exists)
DROP FUNCTION IF EXISTS public.get_trending_products(integer, integer, text);

-- Recreate the function with explicit casting for free_notes to text
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
    p.id,
    p.name,
    p.description,
    p.price,
    p.images,
    p.design_files,
    p.quantity,
    p.minimum_order_quantity,
    p.category_id,
    p.collection_id,
    p.variants,
    p.variant_prices,
    p.slug,
    p.visible,
    p.sale_ended,
    p.pin_order,
    p.blank_code,
    p.technique,
    p.note_for_supplier,
    p.collection_name,
    p.collection_slug,
    p.collection_launch_date,
    p.collection_sale_ended,
    p.category_name,
    p.category_description,
    p.category_type,
    p.category_eligibility_rules,
    p.category_sale_ended,
    p.shipping_notes,
    p.quality_notes,
    p.returns_notes,
    COALESCE(p.free_notes, '')::text, -- Explicitly cast free_notes to text
    p.price_modifier_before_min,
    p.price_modifier_after_min,
    p.sales_count,
    rp.order_count,
    rp.rank
  FROM public_products_with_categories p
  JOIN ranked_products rp ON p.id = rp.id
  WHERE rp.rank > p_offset AND rp.rank <= (p_offset + p_limit)
  ORDER BY rp.rank;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.get_trending_products(integer, integer, text) TO anon;

-- Add comment
COMMENT ON FUNCTION public.get_trending_products(integer, integer, text) IS 'Returns products ranked by sales count for specified time period (today, last_7_days, last_30_days, all_time)';

COMMIT; 