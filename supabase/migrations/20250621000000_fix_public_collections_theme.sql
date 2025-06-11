-- Fix public_collections view to include theme fields for anonymous access
-- This ensures themes work for all users, not just admins

BEGIN;

-- Drop existing view and recreate with theme fields
DROP VIEW IF EXISTS public_collections CASCADE;

-- Create view with ALL necessary fields including theme data
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
  slug,
  user_id,
  custom_url,
  x_url,
  telegram_url,
  dexscreener_url,
  pumpfun_url,
  website_url,
  free_notes,
  -- THEME FIELDS - These are critical for frontend theme system
  theme_primary_color,
  theme_secondary_color,
  theme_background_color,
  theme_text_color,
  theme_use_classic,
  theme_logo_url,
  theme_use_custom,
  -- TIMESTAMPS - Expected by TypeScript types
  created_at,
  updated_at
FROM collections
WHERE visible = true;

-- Grant explicit permissions to anonymous users
GRANT SELECT ON public_collections TO anon;
GRANT SELECT ON public_collections TO authenticated;

-- Recreate the public functions that depend on this view
DROP FUNCTION IF EXISTS public.get_featured_collections();
DROP FUNCTION IF EXISTS public.get_upcoming_collections();
DROP FUNCTION IF EXISTS public.get_latest_collections(integer, integer);

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

CREATE OR REPLACE FUNCTION public.get_latest_collections(p_limit integer DEFAULT 10, p_offset integer DEFAULT 0)
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

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.get_featured_collections() TO anon;
GRANT EXECUTE ON FUNCTION public.get_upcoming_collections() TO anon;
GRANT EXECUTE ON FUNCTION public.get_latest_collections(integer, integer) TO anon;

-- Verify the view was created correctly
DO $$
BEGIN
  -- Check if theme fields exist in the view
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'public_collections' 
    AND column_name = 'theme_primary_color'
  ) THEN
    RAISE EXCEPTION 'theme_primary_color column missing from public_collections view';
  END IF;

  -- Check permissions
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_privileges 
    WHERE table_name = 'public_collections' 
    AND grantee = 'anon'
    AND privilege_type = 'SELECT'
  ) THEN
    RAISE EXCEPTION 'SELECT permission not granted to anon on public_collections';
  END IF;

  RAISE NOTICE 'public_collections view successfully updated with theme fields and permissions';
END $$;

COMMIT; 