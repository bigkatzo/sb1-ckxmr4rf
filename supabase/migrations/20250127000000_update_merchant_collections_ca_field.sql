-- Update merchant_collections and public_collections views to ensure ca field is properly included
BEGIN;

-- Drop existing views
DROP VIEW IF EXISTS merchant_collections CASCADE;
DROP VIEW IF EXISTS public_collections CASCADE;

-- Recreate public_collections view with ca field
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
  theme_primary_color,
  theme_secondary_color,
  theme_background_color,
  theme_text_color,
  theme_use_classic,
  theme_logo_url,
  -- Compute theme_use_custom based on whether any theme colors are set
  COALESCE(
    theme_primary_color IS NOT NULL OR 
    theme_secondary_color IS NOT NULL OR 
    theme_background_color IS NOT NULL OR 
    theme_text_color IS NOT NULL OR 
    theme_logo_url IS NOT NULL,
    false
  ) as theme_use_custom
FROM collections
WHERE visible = true;

-- Recreate merchant_collections view with explicit field selection to ensure ca field is included
CREATE VIEW merchant_collections AS
SELECT 
  c.id,
  c.name,
  c.description,
  c.image_url,
  c.launch_date,
  c.created_at,
  c.updated_at,
  c.user_id,
  c.featured,
  c.visible,
  c.sale_ended,
  c.slug,
  c.custom_url,
  c.x_url,
  c.telegram_url,
  c.dexscreener_url,
  c.pumpfun_url,
  c.website_url,
  c.free_notes,
  c.ca,
  c.theme_primary_color,
  c.theme_secondary_color,
  c.theme_background_color,
  c.theme_text_color,
  c.theme_use_custom,
  c.theme_use_classic,
  c.theme_logo_url,
  COALESCE(
    up.display_name, 
    u.raw_user_meta_data->>'username', 
    split_part(u.email, '@', 1)
  ) as owner_username,
  COALESCE(up.merchant_tier::text, 'starter_merchant') as owner_merchant_tier,
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
LEFT JOIN user_profiles up ON up.id = c.user_id
LEFT JOIN collection_access ca ON ca.collection_id = c.id AND ca.user_id = auth.uid()
WHERE 
  (SELECT is_admin()) OR
  c.user_id = auth.uid() OR
  ca.collection_id IS NOT NULL;

-- Grant permissions
GRANT SELECT ON merchant_collections TO authenticated;
GRANT SELECT ON public_collections TO authenticated, anon;

-- Recreate the get_merchant_collections function
CREATE OR REPLACE FUNCTION get_merchant_collections()
RETURNS SETOF merchant_collections
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM merchant_collections
  ORDER BY created_at DESC;
$$;

-- Recreate the get_featured_collections function
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

-- Recreate the get_upcoming_collections function
CREATE OR REPLACE FUNCTION public.get_upcoming_collections()
RETURNS SETOF public_collections
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public_collections
  WHERE launch_date > NOW()
  ORDER BY launch_date ASC;
$$;

-- Recreate the get_latest_collections function
CREATE OR REPLACE FUNCTION public.get_latest_collections(
  p_limit integer DEFAULT NULL,
  p_offset integer DEFAULT 0
)
RETURNS SETOF public_collections
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public_collections
  ORDER BY created_at DESC
  LIMIT COALESCE(p_limit, 50)
  OFFSET p_offset;
$$;

COMMIT; 