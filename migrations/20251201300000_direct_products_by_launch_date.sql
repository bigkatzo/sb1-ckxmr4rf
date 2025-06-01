-- Fix get_products_by_launch_date to directly use public_products_with_categories view
-- This will ensure new products appear immediately without relying on materialized view refresh
BEGIN;

-- Drop the existing function
DROP FUNCTION IF EXISTS public.get_products_by_launch_date(integer, integer);

-- Recreate the function to directly query the public_products_with_categories view
CREATE FUNCTION public.get_products_by_launch_date(
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
        ORDER BY p.collection_launch_date DESC, p.id -- Sort by launch date (newest first)
      ) AS rank
    FROM public_products_with_categories p
    WHERE (p.collection_sale_ended = false OR p.collection_sale_ended IS NULL)
      AND (p.category_sale_ended = false OR p.category_sale_ended IS NULL)
      AND (p.sale_ended = false OR p.sale_ended IS NULL)
      AND p.visible = true
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
    p.free_notes,
    p.price_modifier_before_min,
    p.price_modifier_after_min,
    0 as sales_count, -- Placeholder for compatibility
    rp.order_count,
    rp.rank
  FROM public_products_with_categories p
  JOIN ranked_products rp ON p.id = rp.id
  WHERE rp.rank > p_offset AND rp.rank <= (p_offset + p_limit)
  ORDER BY rp.rank;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.get_products_by_launch_date(integer, integer) TO anon;

-- Add comment to document the purpose of this change
COMMENT ON FUNCTION public.get_products_by_launch_date(integer, integer) IS 
  'Returns products ranked by launch date (newest first) - directly queries base tables for immediate results';

COMMIT; 