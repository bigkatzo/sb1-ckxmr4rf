-- Start transaction
BEGIN;

-- Drop views to remove constraints
DROP VIEW IF EXISTS public_collections CASCADE;
DROP VIEW IF EXISTS merchant_collections CASCADE;

-- Recreate public_collections view with all necessary fields
CREATE VIEW public_collections AS
SELECT 
  c.*,
  COALESCE(
    (SELECT COUNT(*) FROM products p WHERE p.collection_id = c.id),
    0
  ) as product_count
FROM collections c
WHERE visible = true;

-- Recreate merchant_collections view
CREATE VIEW merchant_collections AS
SELECT 
  c.*,
  u.email as owner_username,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'admin'
    ) THEN 'admin'
    WHEN c.user_id = auth.uid() THEN NULL
    WHEN ca.access_type IS NOT NULL THEN ca.access_type
    ELSE NULL
  END as access_type
FROM collections c
JOIN auth.users u ON u.id = c.user_id
LEFT JOIN collection_access ca ON ca.collection_id = c.id AND ca.user_id = auth.uid()
WHERE 
  (SELECT is_admin()) OR
  c.user_id = auth.uid() OR
  ca.collection_id IS NOT NULL;

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS public.get_featured_collections();
DROP FUNCTION IF EXISTS public.get_upcoming_collections();
DROP FUNCTION IF EXISTS public.get_latest_collections();

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

CREATE OR REPLACE FUNCTION public.get_latest_collections(p_limit int DEFAULT 10, p_offset int DEFAULT 0)
RETURNS SETOF public_collections
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public_collections
  WHERE launch_date <= now()
  ORDER BY launch_date DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- Ensure proper permissions
GRANT EXECUTE ON FUNCTION public.get_featured_collections() TO anon;
GRANT EXECUTE ON FUNCTION public.get_upcoming_collections() TO anon;
GRANT EXECUTE ON FUNCTION public.get_latest_collections(int, int) TO anon;

-- Add explicit comments for better documentation
COMMENT ON FUNCTION public.get_featured_collections() IS 'Returns featured collections that are visible to the public';
COMMENT ON FUNCTION public.get_upcoming_collections() IS 'Returns upcoming collections that are visible to the public';
COMMENT ON FUNCTION public.get_latest_collections(int, int) IS 'Returns latest collections that are visible to the public with pagination support';

-- Verify the functions were created successfully
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_proc 
    WHERE proname = 'get_featured_collections'
  ) THEN
    RAISE EXCEPTION 'Function get_featured_collections was not created successfully';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_proc 
    WHERE proname = 'get_upcoming_collections'
  ) THEN
    RAISE EXCEPTION 'Function get_upcoming_collections was not created successfully';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_proc 
    WHERE proname = 'get_latest_collections'
  ) THEN
    RAISE EXCEPTION 'Function get_latest_collections was not created successfully';
  END IF;
END $$;

-- Commit transaction
COMMIT; 