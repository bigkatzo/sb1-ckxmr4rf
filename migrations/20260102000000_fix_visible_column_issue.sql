-- Fix column reference issues in views and functions
-- The columns exist, but the views/functions are referencing them incorrectly

BEGIN;

-- Drop the existing view with CASCADE to handle dependencies
DROP VIEW IF EXISTS public_products_with_categories CASCADE;

-- Recreate the view with proper column references (columns exist, just fixing references)
CREATE VIEW public_products_with_categories AS
SELECT 
  p.id,
  p.name,
  p.description,
  p.price,
  p.images,
  COALESCE(p.design_files, ARRAY[]::text[]) as design_files,
  p.quantity,
  p.minimum_order_quantity,
  p.category_id,
  p.collection_id,
  p.variants,
  p.variant_prices,
  p.slug,
  p.visible,
  COALESCE(p.sale_ended, false) as sale_ended,
  p.pin_order,
  p.blank_code,
  p.technique,
  p.note_for_supplier,
  p.created_at,
  c.name as collection_name,
  c.slug as collection_slug,
  c.launch_date as collection_launch_date,
  COALESCE(c.sale_ended, false) as collection_sale_ended,
  cat.name as category_name,
  cat.description as category_description,
  cat.type as category_type,
  cat.eligibility_rules as category_eligibility_rules,
  COALESCE(cat.sale_ended, false) as category_sale_ended,
  COALESCE(p.notes->>'shipping', '') as shipping_notes,
  COALESCE(p.notes->>'quality', '') as quality_notes,
  COALESCE(p.notes->>'returns', '') as returns_notes,
  p.free_notes,
  p.price_modifier_before_min,
  p.price_modifier_after_min,
  0 as sales_count
FROM products p
JOIN collections c ON c.id = p.collection_id
LEFT JOIN categories cat ON cat.id = p.category_id
WHERE p.visible = true
  AND COALESCE(c.visible, true) = true
  AND (cat.id IS NULL OR COALESCE(cat.visible, true) = true);

-- Grant permissions on the view
GRANT SELECT ON public_products_with_categories TO anon;

-- Recreate get_best_sellers function with proper visible column handling
DROP FUNCTION IF EXISTS public.get_best_sellers(integer, text);
CREATE OR REPLACE FUNCTION public.get_best_sellers(p_limit integer DEFAULT 6, p_sort_by text DEFAULT 'sales')
RETURNS SETOF public_products_with_categories
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.*
  FROM public_products_with_categories p
  LEFT JOIN public_order_counts oc ON p.id = oc.product_id
  WHERE (p.collection_sale_ended = false OR p.collection_sale_ended IS NULL)
    AND (p.category_sale_ended = false OR p.category_sale_ended IS NULL)
    AND (p.sale_ended = false OR p.sale_ended IS NULL)
  ORDER BY 
    CASE 
      WHEN p_sort_by = 'sales' THEN COALESCE(oc.total_orders, 0)
      WHEN p_sort_by = 'price_asc' THEN p.price 
      WHEN p_sort_by = 'price_desc' THEN p.price
      ELSE COALESCE(oc.total_orders, 0)
    END DESC,
    CASE WHEN p_sort_by = 'price_asc' THEN 1 ELSE 0 END,
    p.id
  LIMIT p_limit;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.get_best_sellers(integer, text) TO anon;

-- Recreate get_trending_products function with proper column references
DROP FUNCTION IF EXISTS public.get_trending_products(integer, integer, text);
CREATE OR REPLACE FUNCTION public.get_trending_products(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_time_period text DEFAULT 'all_time'
)
RETURNS SETOF public_products_with_categories
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.*
  FROM public_products_with_categories p
  LEFT JOIN public_order_counts oc ON p.id = oc.product_id
  WHERE (p.collection_sale_ended = false OR p.collection_sale_ended IS NULL)
    AND (p.category_sale_ended = false OR p.category_sale_ended IS NULL)
    AND (p.sale_ended = false OR p.sale_ended IS NULL)
  ORDER BY COALESCE(oc.total_orders, 0) DESC, p.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

-- Grant execute permission on get_trending_products
GRANT EXECUTE ON FUNCTION public.get_trending_products(integer, integer, text) TO anon;

-- Recreate get_products_by_launch_date function with proper column references
DROP FUNCTION IF EXISTS public.get_products_by_launch_date(integer, integer);
CREATE OR REPLACE FUNCTION public.get_products_by_launch_date(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS SETOF public_products_with_categories
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.*
  FROM public_products_with_categories p
  WHERE (p.collection_sale_ended = false OR p.collection_sale_ended IS NULL)
    AND (p.category_sale_ended = false OR p.category_sale_ended IS NULL)
    AND (p.sale_ended = false OR p.sale_ended IS NULL)
  ORDER BY p.created_at DESC, p.id
  LIMIT p_limit OFFSET p_offset;
$$;

-- Grant execute permission on get_products_by_launch_date
GRANT EXECUTE ON FUNCTION public.get_products_by_launch_date(integer, integer) TO anon;

COMMIT; 