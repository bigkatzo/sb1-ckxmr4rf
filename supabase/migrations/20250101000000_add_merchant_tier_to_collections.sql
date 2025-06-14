-- Add merchant tier to collections and products for badge display
-- This migration updates existing functions to include merchant tier from collection owners

BEGIN;

-- Update get_featured_collections function to include merchant tier
DROP FUNCTION IF EXISTS public.get_featured_collections();
CREATE OR REPLACE FUNCTION public.get_featured_collections()
RETURNS TABLE(
  id uuid,
  name text,
  description text,
  image_url text,
  launch_date timestamptz,
  featured boolean,
  visible boolean,
  sale_ended boolean,
  slug text,
  owner_merchant_tier merchant_tier
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    c.id,
    c.name,
    c.description,
    c.image_url,
    c.launch_date,
    c.featured,
    c.visible,
    c.sale_ended,
    c.slug,
    up.merchant_tier as owner_merchant_tier
  FROM collections c
  LEFT JOIN user_profiles up ON c.user_id = up.id
  WHERE c.featured = true AND c.visible = true
  ORDER BY c.launch_date DESC;
$$;

-- Update get_upcoming_collections function to include merchant tier
DROP FUNCTION IF EXISTS public.get_upcoming_collections();
CREATE OR REPLACE FUNCTION public.get_upcoming_collections()
RETURNS TABLE(
  id uuid,
  name text,
  description text,
  image_url text,
  launch_date timestamptz,
  featured boolean,
  visible boolean,
  sale_ended boolean,
  slug text,
  owner_merchant_tier merchant_tier
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    c.id,
    c.name,
    c.description,
    c.image_url,
    c.launch_date,
    c.featured,
    c.visible,
    c.sale_ended,
    c.slug,
    up.merchant_tier as owner_merchant_tier
  FROM collections c
  LEFT JOIN user_profiles up ON c.user_id = up.id
  WHERE c.launch_date > now() AND c.visible = true
  ORDER BY c.launch_date ASC;
$$;

-- Update get_latest_collections function to include merchant tier
DROP FUNCTION IF EXISTS public.get_latest_collections();
CREATE OR REPLACE FUNCTION public.get_latest_collections()
RETURNS TABLE(
  id uuid,
  name text,
  description text,
  image_url text,
  launch_date timestamptz,
  featured boolean,
  visible boolean,
  sale_ended boolean,
  slug text,
  owner_merchant_tier merchant_tier
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    c.id,
    c.name,
    c.description,
    c.image_url,
    c.launch_date,
    c.featured,
    c.visible,
    c.sale_ended,
    c.slug,
    up.merchant_tier as owner_merchant_tier
  FROM collections c
  LEFT JOIN user_profiles up ON c.user_id = up.id
  WHERE c.launch_date <= now() AND c.visible = true
  ORDER BY c.launch_date DESC;
$$;

-- Update public_products_with_categories view to include collection owner merchant tier
DROP VIEW IF EXISTS public_products_with_categories CASCADE;
CREATE VIEW public_products_with_categories AS
SELECT 
  p.id,
  p.name,
  p.sku,
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
  p.created_at,
  c.name as collection_name,
  c.slug as collection_slug,
  c.launch_date as collection_launch_date,
  c.sale_ended as collection_sale_ended,
  up.merchant_tier as collection_owner_merchant_tier,
  cat.name as category_name,
  cat.description as category_description,
  cat.type as category_type,
  cat.eligibility_rules as category_eligibility_rules,
  cat.sale_ended as category_sale_ended,
  COALESCE(p.notes->>'shipping', '') as shipping_notes,
  COALESCE(p.notes->>'quality', '') as quality_notes,
  COALESCE(p.notes->>'returns', '') as returns_notes,
  p.free_notes,
  p.price_modifier_before_min,
  p.price_modifier_after_min,
  0 as sales_count
FROM products p
JOIN collections c ON c.id = p.collection_id
LEFT JOIN user_profiles up ON c.user_id = up.id
LEFT JOIN categories cat ON cat.id = p.category_id
WHERE p.visible = true AND c.visible = true;

-- Update get_trending_products function to include merchant tier if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_trending_products') THEN
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
    AS $func$
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
    $func$;
    
    GRANT EXECUTE ON FUNCTION public.get_trending_products(integer, integer, text) TO anon;
  END IF;
END $$;

-- Update get_products_by_launch_date function to include merchant tier if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_products_by_launch_date') THEN
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
      rank bigint
    )
    LANGUAGE sql
    SECURITY DEFINER
    SET search_path = public
    AS $func$
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
    $func$;
    
    GRANT EXECUTE ON FUNCTION public.get_products_by_launch_date(integer, integer) TO anon;
  END IF;
END $$;

-- Grant permissions
GRANT SELECT ON public_products_with_categories TO anon;
GRANT EXECUTE ON FUNCTION public.get_featured_collections() TO anon;
GRANT EXECUTE ON FUNCTION public.get_upcoming_collections() TO anon;
GRANT EXECUTE ON FUNCTION public.get_latest_collections() TO anon;

COMMIT; 