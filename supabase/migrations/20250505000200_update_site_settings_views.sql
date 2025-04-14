-- This migration updates any views or functions that reference site_settings
-- to ensure they include the new columns: homepage_tagline, seo_title, seo_description

-- Refresh public views that contain site settings data
CREATE OR REPLACE VIEW public.public_site_settings AS
SELECT 
  site_name,
  site_description,
  homepage_tagline,
  seo_title,
  seo_description,
  theme_primary_color,
  theme_secondary_color,
  theme_background_color,
  theme_text_color,
  favicon_url,
  icon_192_url,
  icon_512_url,
  apple_touch_icon_url,
  og_image_url,
  twitter_image_url
FROM site_settings
WHERE id = 1;

-- Grant access to the public view
GRANT SELECT ON public_site_settings TO anon, authenticated;

-- Fix RLS to ensure site settings access is properly handled
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users 
    WHERE 
      id = auth.uid() 
      AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER; 