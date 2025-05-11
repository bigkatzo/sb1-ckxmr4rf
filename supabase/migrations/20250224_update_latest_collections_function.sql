-- Update get_latest_collections function to support pagination
-- This will allow infinite scrolling of collections

-- Drop the existing function
DROP FUNCTION IF EXISTS public.get_latest_collections();

-- Recreate with pagination parameters
CREATE OR REPLACE FUNCTION public.get_latest_collections(
  p_limit integer DEFAULT NULL, -- NULL means no limit
  p_offset integer DEFAULT 0
)
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

-- Grant execution permission
GRANT EXECUTE ON FUNCTION public.get_latest_collections(integer, integer) TO anon;

-- Add documentation
COMMENT ON FUNCTION public.get_latest_collections(integer, integer) IS 
'Returns latest collections with pagination support for infinite scrolling.
 p_limit: number of collections to return (NULL = no limit)
 p_offset: number of collections to skip'; 