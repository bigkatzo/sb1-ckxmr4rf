-- Fix public_products_with_categories view to include pin_order field
BEGIN;

-- Drop the existing view with CASCADE to handle dependencies
DROP VIEW IF EXISTS public_products_with_categories CASCADE;

-- Recreate the view with pin_order included
CREATE VIEW public_products_with_categories AS
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
  p.pin_order,  -- Add pin_order field
  p.blank_code,  -- Add blank_code field
  p.technique,  -- Add technique field
  p.note_for_supplier,  -- Add note_for_supplier field
  c.name as collection_name,
  c.slug as collection_slug,
  c.launch_date as collection_launch_date,
  c.sale_ended as collection_sale_ended,
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
  -- Use a subquery instead of direct join for sales_count (will be overridden by the function)
  0 as sales_count
FROM products p
JOIN collections c ON c.id = p.collection_id
LEFT JOIN categories cat ON cat.id = p.category_id
WHERE p.visible = true
AND c.visible = true;

-- Grant permissions on the view
GRANT SELECT ON public_products_with_categories TO anon;

-- Recreate get_best_sellers function to ensure it works with the updated view
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
    CASE WHEN p_sort_by = 'price_asc' THEN 1 ELSE 0 END, -- For ascending price order
    p.id
  LIMIT p_limit;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.get_best_sellers(integer, text) TO anon;

-- Recreate get_best_sellers_v2 function for collection-specific products
DROP FUNCTION IF EXISTS public.get_best_sellers_v2(integer, text);
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
    AND (p.collection_sale_ended = false OR p.collection_sale_ended IS NULL)
    AND (p.category_sale_ended = false OR p.category_sale_ended IS NULL)
    AND (p.sale_ended = false OR p.sale_ended IS NULL)
  ORDER BY COALESCE(oc.total_orders, 0) DESC, p.collection_launch_date DESC
  LIMIT limit_count;
$$;

-- Grant execute permission on the second function
GRANT EXECUTE ON FUNCTION public.get_best_sellers_v2(integer, text) TO anon;

COMMIT; 