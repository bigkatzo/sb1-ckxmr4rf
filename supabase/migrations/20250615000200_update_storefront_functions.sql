-- Start transaction
BEGIN;

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

-- Ensure proper permissions
GRANT EXECUTE ON FUNCTION public.get_featured_collections() TO anon;
GRANT EXECUTE ON FUNCTION public.get_upcoming_collections() TO anon;
GRANT EXECUTE ON FUNCTION public.get_latest_collections() TO anon;

-- Add explicit comments for better documentation
COMMENT ON FUNCTION public.get_featured_collections() IS 'Returns featured collections that are visible to the public';
COMMENT ON FUNCTION public.get_upcoming_collections() IS 'Returns upcoming collections that are visible to the public';
COMMENT ON FUNCTION public.get_latest_collections() IS 'Returns latest collections that are visible to the public';

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