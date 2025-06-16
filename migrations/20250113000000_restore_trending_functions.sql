-- Restore proper trending functions that return order_count and rank fields
-- This fixes the trending page that was broken by the Jan 2 migrations

BEGIN;

-- Restore get_trending_products function with proper return signature
DROP FUNCTION IF EXISTS public.get_trending_products(integer, integer, text);
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
  collection_user_id uuid,
  collection_owner_merchant_tier merchant_tier,
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
        WHEN p_time_period = 'today' THEN COALESCE((
          SELECT COUNT(*)
          FROM orders o
          WHERE o.product_id = p.id
          AND o.status IN ('confirmed', 'preparing', 'shipped', 'delivered')
          AND o.created_at >= CURRENT_DATE
        ), 0)
        WHEN p_time_period = 'last_7_days' THEN COALESCE((
          SELECT COUNT(*)
          FROM orders o
          WHERE o.product_id = p.id
          AND o.status IN ('confirmed', 'preparing', 'shipped', 'delivered')
          AND o.created_at >= CURRENT_DATE - INTERVAL '7 days'
        ), 0)
        WHEN p_time_period = 'last_30_days' THEN COALESCE((
          SELECT COUNT(*)
          FROM orders o
          WHERE o.product_id = p.id
          AND o.status IN ('confirmed', 'preparing', 'shipped', 'delivered')
          AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'
        ), 0)
        ELSE COALESCE(oc.total_orders, 0)
      END AS order_count,
      ROW_NUMBER() OVER (
        ORDER BY 
          CASE 
            WHEN p_time_period = 'today' THEN COALESCE((
              SELECT COUNT(*)
              FROM orders o
              WHERE o.product_id = p.id
              AND o.status IN ('confirmed', 'preparing', 'shipped', 'delivered')
              AND o.created_at >= CURRENT_DATE
            ), 0)
            WHEN p_time_period = 'last_7_days' THEN COALESCE((
              SELECT COUNT(*)
              FROM orders o
              WHERE o.product_id = p.id
              AND o.status IN ('confirmed', 'preparing', 'shipped', 'delivered')
              AND o.created_at >= CURRENT_DATE - INTERVAL '7 days'
            ), 0)
            WHEN p_time_period = 'last_30_days' THEN COALESCE((
              SELECT COUNT(*)
              FROM orders o
              WHERE o.product_id = p.id
              AND o.status IN ('confirmed', 'preparing', 'shipped', 'delivered')
              AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'
            ), 0)
            ELSE COALESCE(oc.total_orders, 0)
          END DESC, 
          p.created_at DESC
      ) AS rank
    FROM public_products_with_categories p
    LEFT JOIN public_order_counts oc ON p.id = oc.product_id
    WHERE (p.collection_sale_ended = false OR p.collection_sale_ended IS NULL)
      AND (p.category_sale_ended = false OR p.category_sale_ended IS NULL)
      AND (p.sale_ended = false OR p.sale_ended IS NULL)
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
    p.collection_user_id,
    p.collection_owner_merchant_tier,
    p.category_name,
    p.category_description,
    p.category_type,
    p.category_eligibility_rules,
    p.category_sale_ended,
    p.shipping_notes,
    p.quality_notes,
    p.returns_notes,
    p.free_notes,
    p.price_modifier_before_min,
    p.price_modifier_after_min,
    0 as sales_count, -- Compatibility field
    rp.order_count,
    rp.rank
  FROM public_products_with_categories p
  JOIN ranked_products rp ON p.id = rp.id
  WHERE rp.rank > p_offset AND rp.rank <= (p_offset + p_limit)
  ORDER BY rp.rank;
$$;

-- Restore get_products_by_launch_date function with proper return signature
DROP FUNCTION IF EXISTS public.get_products_by_launch_date(integer, integer);
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
  collection_user_id uuid,
  collection_owner_merchant_tier merchant_tier,
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
      COALESCE((
        SELECT COUNT(*)
        FROM orders o
        WHERE o.product_id = p.id
        AND o.status IN ('confirmed', 'preparing', 'shipped', 'delivered')
      ), 0) AS order_count,
      ROW_NUMBER() OVER (
        ORDER BY p.created_at DESC, p.id -- Sort by creation date (newest first)
      ) AS rank
    FROM public_products_with_categories p
    WHERE (p.collection_sale_ended = false OR p.collection_sale_ended IS NULL)
      AND (p.category_sale_ended = false OR p.category_sale_ended IS NULL)
      AND (p.sale_ended = false OR p.sale_ended IS NULL)
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
    p.collection_user_id,
    p.collection_owner_merchant_tier,
    p.category_name,
    p.category_description,
    p.category_type,
    p.category_eligibility_rules,
    p.category_sale_ended,
    p.shipping_notes,
    p.quality_notes,
    p.returns_notes,
    p.free_notes,
    p.price_modifier_before_min,
    p.price_modifier_after_min,
    0 as sales_count, -- Compatibility field
    rp.order_count,
    rp.rank
  FROM public_products_with_categories p
  JOIN ranked_products rp ON p.id = rp.id
  WHERE rp.rank > p_offset AND rp.rank <= (p_offset + p_limit)
  ORDER BY rp.rank;
$$;

-- Add count functions that the frontend expects
CREATE OR REPLACE FUNCTION public.count_trending_products(p_time_period text DEFAULT 'all_time')
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)
  FROM public_products_with_categories p
  LEFT JOIN public_order_counts oc ON p.id = oc.product_id
  WHERE (p.collection_sale_ended = false OR p.collection_sale_ended IS NULL)
    AND (p.category_sale_ended = false OR p.category_sale_ended IS NULL)
    AND (p.sale_ended = false OR p.sale_ended IS NULL)
    AND (
      CASE 
        WHEN p_time_period = 'today' THEN EXISTS (
          SELECT 1 FROM orders o
          WHERE o.product_id = p.id
          AND o.status IN ('confirmed', 'preparing', 'shipped', 'delivered')
          AND o.created_at >= CURRENT_DATE
        )
        WHEN p_time_period = 'last_7_days' THEN EXISTS (
          SELECT 1 FROM orders o
          WHERE o.product_id = p.id
          AND o.status IN ('confirmed', 'preparing', 'shipped', 'delivered')
          AND o.created_at >= CURRENT_DATE - INTERVAL '7 days'
        )
        WHEN p_time_period = 'last_30_days' THEN EXISTS (
          SELECT 1 FROM orders o
          WHERE o.product_id = p.id
          AND o.status IN ('confirmed', 'preparing', 'shipped', 'delivered')
          AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'
        )
        ELSE TRUE  -- For 'all_time', include all products
      END
    );
$$;

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
    AND (p.sale_ended = false OR p.sale_ended IS NULL);
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.get_trending_products(integer, integer, text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_products_by_launch_date(integer, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.count_trending_products(text) TO anon;
GRANT EXECUTE ON FUNCTION public.count_products_by_launch_date() TO anon;

-- Add comments
COMMENT ON FUNCTION public.get_trending_products(integer, integer, text) IS 'Returns products ranked by sales count with order_count and rank fields for trending page';
COMMENT ON FUNCTION public.get_products_by_launch_date(integer, integer) IS 'Returns products ranked by creation date with order_count and rank fields for new products tab';

COMMIT; 