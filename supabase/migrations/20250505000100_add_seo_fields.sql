-- Add new SEO fields to site_settings table
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS homepage_tagline TEXT DEFAULT 'Discover and shop unique merchandise collections at store.fun';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS seo_title TEXT DEFAULT '';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS seo_description TEXT DEFAULT '';

-- Update the default settings record if it exists
UPDATE site_settings 
SET 
  homepage_tagline = 'Discover and shop unique merchandise collections at store.fun',
  seo_title = '',
  seo_description = ''
WHERE id = 1; 