-- Add created_at field to public_products_with_categories view to fix "newest" sort
BEGIN;

-- Drop the existing view with CASCADE to handle dependencies
DROP VIEW IF EXISTS public_products_with_categories CASCADE;

-- Recreate the view including the created_at field from products table
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
  p.pin_order,
  p.blank_code,
  p.technique,
  p.note_for_supplier,
  p.created_at,  -- Add created_at field
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

-- Update functions that rely on this view
-- First create a function to count products by launch date
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

-- Update the get_products_by_launch_date function to use created_at directly
DROP FUNCTION IF EXISTS public.get_products_by_launch_date(integer, integer);
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
  created_at timestamptz,
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
        ORDER BY p.created_at DESC, p.id -- Sort by creation date (newest first)
      ) AS rank
    FROM products p
    JOIN public_products_with_categories pc ON p.id = pc.id
    WHERE (pc.collection_sale_ended = false OR pc.collection_sale_ended IS NULL)
      AND (pc.category_sale_ended = false OR pc.category_sale_ended IS NULL)
      AND (pc.sale_ended = false OR pc.sale_ended IS NULL)
      AND pc.visible = true
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
    p.created_at,
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

-- Drop and recreate best sellers function with modified return type
-- Temporarily create a separate function to avoid the type issue
DROP FUNCTION IF EXISTS public.get_best_sellers(integer, text);
CREATE OR REPLACE FUNCTION public.get_best_sellers(p_limit integer DEFAULT 6, p_sort_by text DEFAULT 'sales')
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
  created_at timestamptz,
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
  sales_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
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
    p.created_at,
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
    COALESCE((
      SELECT COUNT(*)
      FROM orders o
      WHERE o.product_id = p.id
      AND o.status IN ('confirmed', 'preparing', 'shipped', 'delivered')
    ), 0)::bigint as sales_count
  FROM public_products_with_categories p
  ORDER BY 
    CASE WHEN p_sort_by = 'sales' THEN 
      COALESCE((
        SELECT COUNT(*)
        FROM orders o
        WHERE o.product_id = p.id
        AND o.status IN ('confirmed', 'preparing', 'shipped', 'delivered')
      ), 0)
    END DESC,
    CASE WHEN p_sort_by = 'launch_date' THEN p.collection_launch_date END DESC,
    CASE WHEN p_sort_by = 'newest' THEN p.created_at END DESC
  LIMIT p_limit;
$$;

COMMIT; 