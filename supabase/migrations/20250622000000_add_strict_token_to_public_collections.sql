-- Add missing ca and strict_token fields to public_collections view
-- This ensures strict token functionality works for all users, not just admins

BEGIN;

-- Drop existing view and recreate with missing fields
DROP VIEW IF EXISTS public_collections CASCADE;

-- Create view with ALL necessary fields including ca and strict_token
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
  ca,
  strict_token,
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
  -- Check if ca field exists in the view
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'public_collections' 
    AND column_name = 'ca'
  ) THEN
    RAISE EXCEPTION 'ca column missing from public_collections view';
  END IF;

  -- Check if strict_token field exists in the view
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'public_collections' 
    AND column_name = 'strict_token'
  ) THEN
    RAISE EXCEPTION 'strict_token column missing from public_collections view';
  END IF;

  -- Check if SELECT permission is granted to anon
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_privileges 
    WHERE table_name = 'public_collections' 
    AND grantee = 'anon' 
    AND privilege_type = 'SELECT'
  ) THEN
    RAISE EXCEPTION 'SELECT permission not granted to anon on public_collections';
  END IF;

  RAISE NOTICE 'public_collections view successfully updated with ca and strict_token fields';
END $$;

COMMIT; 