-- Start transaction
BEGIN;

-- Add free_notes field to collections table
ALTER TABLE collections
ADD COLUMN IF NOT EXISTS free_notes text;

-- Drop existing views and functions that depend on collections
DROP VIEW IF EXISTS public_collections CASCADE;
DROP VIEW IF EXISTS merchant_collections CASCADE;
DROP FUNCTION IF EXISTS get_featured_collections();
DROP FUNCTION IF EXISTS get_upcoming_collections();
DROP FUNCTION IF EXISTS get_latest_collections();

-- Recreate public_collections view to include free_notes
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
  free_notes
FROM collections
WHERE visible = true;

-- Recreate merchant_collections view to include free_notes
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

-- Recreate the merchant functions
CREATE OR REPLACE FUNCTION get_merchant_collections()
RETURNS SETOF merchant_collections
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM merchant_collections
  ORDER BY created_at DESC;
$$;

-- Recreate the storefront functions
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
  ORDER BY launch_date DESC
  LIMIT 6;
$$;

-- Grant permissions
GRANT SELECT ON public_collections TO anon;
GRANT SELECT ON merchant_collections TO authenticated;
GRANT EXECUTE ON FUNCTION get_merchant_collections() TO authenticated;
GRANT EXECUTE ON FUNCTION get_featured_collections() TO anon;
GRANT EXECUTE ON FUNCTION get_upcoming_collections() TO anon;
GRANT EXECUTE ON FUNCTION get_latest_collections() TO anon;

-- Verify changes
DO $$
BEGIN
  -- Check if column was added
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'collections'
    AND column_name = 'free_notes'
  ) THEN
    RAISE EXCEPTION 'Failed to add free_notes column';
  END IF;
END $$;

-- Commit transaction
COMMIT; 