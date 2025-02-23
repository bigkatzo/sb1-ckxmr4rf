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
  AND sale_ended = false
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
COMMENT ON FUNCTION public.get_latest_collections() IS 'Returns latest collections that are visible and have active sales';
COMMENT ON FUNCTION public.get_best_sellers() IS 'Returns best-selling products from visible collections with active sales'; 