-- First drop existing views if they exist
DROP VIEW IF EXISTS public_collections CASCADE;
DROP VIEW IF EXISTS public_products CASCADE;
DROP VIEW IF EXISTS public_categories CASCADE;

-- Create the views
CREATE VIEW public_collections AS
SELECT 
  id,
  name,
  description,
  image_url,
  launch_date,
  featured,
  visible,
  sale_ended,
  slug
FROM collections
WHERE visible = true;

CREATE VIEW public_products AS
SELECT 
  p.id,
  p.name,
  p.description,
  p.price,
  p.images,
  p.quantity,
  p.minimum_order_quantity,
  p.category_id,
  p.variants,
  p.variant_prices,
  p.slug,
  c.id as collection_id,
  c.name as collection_name,
  c.slug as collection_slug,
  c.launch_date as collection_launch_date,
  c.sale_ended as collection_sale_ended
FROM products p
JOIN collections c ON c.id = p.collection_id
WHERE c.visible = true;

CREATE VIEW public_categories AS
SELECT 
  cat.id,
  cat.name,
  cat.description,
  cat.type,
  cat.eligibility_rules,
  cat.collection_id
FROM categories cat
JOIN collections c ON c.id = cat.collection_id
WHERE c.visible = true;

-- Grant access to the public views
GRANT SELECT ON public_collections TO anon;
GRANT SELECT ON public_products TO anon;
GRANT SELECT ON public_categories TO anon;

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS get_featured_collections();
DROP FUNCTION IF EXISTS get_upcoming_collections();
DROP FUNCTION IF EXISTS get_latest_collections();
DROP FUNCTION IF EXISTS get_best_sellers(integer);

-- Recreate the functions with proper schema and permissions
CREATE OR REPLACE FUNCTION public.get_featured_collections()
RETURNS SETOF public_collections
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public_collections
  WHERE featured = true
  ORDER BY launch_date DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_upcoming_collections()
RETURNS SETOF public_collections
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public_collections
  WHERE launch_date > now()
  ORDER BY launch_date ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_latest_collections()
RETURNS SETOF public_collections
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public_collections
  WHERE launch_date <= now()
  ORDER BY launch_date DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_best_sellers(p_limit integer DEFAULT 6)
RETURNS SETOF public_products
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public_products
  WHERE collection_sale_ended = false
  ORDER BY quantity DESC
  LIMIT p_limit;
$$;

-- Ensure proper permissions
GRANT EXECUTE ON FUNCTION public.get_featured_collections() TO anon;
GRANT EXECUTE ON FUNCTION public.get_upcoming_collections() TO anon;
GRANT EXECUTE ON FUNCTION public.get_latest_collections() TO anon;
GRANT EXECUTE ON FUNCTION public.get_best_sellers(integer) TO anon;

-- Add explicit comments for better documentation
COMMENT ON FUNCTION public.get_featured_collections() IS 'Returns featured collections that are visible to the public';
COMMENT ON FUNCTION public.get_upcoming_collections() IS 'Returns upcoming collections that are visible to the public';
COMMENT ON FUNCTION public.get_latest_collections() IS 'Returns latest collections that are visible to the public';
COMMENT ON FUNCTION public.get_best_sellers(integer) IS 'Returns best-selling products from visible collections with active sales'; 