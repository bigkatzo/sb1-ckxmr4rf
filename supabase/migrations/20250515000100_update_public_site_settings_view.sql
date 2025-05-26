-- Drop existing view first
DROP VIEW IF EXISTS public.public_site_settings;

-- Create public view with the new column
CREATE VIEW public.public_site_settings AS
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
  favicon_96_url,
  icon_192_url,
  icon_512_url,
  apple_touch_icon_url,
  og_image_url,
  twitter_image_url,
  theme_use_classic
FROM site_settings
WHERE id = 1;

-- Ensure proper access permissions
GRANT SELECT ON public_site_settings TO anon, authenticated; 