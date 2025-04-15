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

-- Create site_settings_admin_policy if it doesn't exist
-- This avoids overriding the existing auth.is_admin() function
DO $$ 
BEGIN
  -- Check if the policy already exists
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'site_settings' 
    AND policyname = 'site_settings_admin_policy'
  ) THEN
    -- Create policy using the existing auth.is_admin() function
    EXECUTE 'CREATE POLICY "site_settings_admin_policy" ON site_settings USING (auth.is_admin()) WITH CHECK (auth.is_admin())';
  END IF;
END $$; 