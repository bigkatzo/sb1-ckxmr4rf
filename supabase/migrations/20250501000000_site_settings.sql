-- Create site_settings table
CREATE TABLE IF NOT EXISTS site_settings (
  id INTEGER PRIMARY KEY,
  site_name TEXT NOT NULL DEFAULT 'store.fun',
  site_description TEXT DEFAULT 'Merch Marketplace',
  theme_primary_color TEXT DEFAULT '#8b5cf6',
  theme_secondary_color TEXT DEFAULT '#4f46e5',
  theme_background_color TEXT DEFAULT '#000000',
  theme_text_color TEXT DEFAULT '#ffffff',
  favicon_url TEXT,
  icon_192_url TEXT,
  icon_512_url TEXT,
  apple_touch_icon_url TEXT,
  og_image_url TEXT,
  twitter_image_url TEXT,
  manifest_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT site_settings_singleton CHECK (id = 1)
);

-- Create RLS policies for site_settings
-- Only admin users can view and modify site settings
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow admin to manage site settings"
  ON site_settings
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin());

-- Create function for updating manifest.json
CREATE OR REPLACE FUNCTION update_manifest_file()
RETURNS TRIGGER AS $$
DECLARE
  storage_result RECORD;
BEGIN
  -- Convert the manifest_json to a string
  IF NEW.manifest_json IS NOT NULL THEN
    -- Upload the manifest to storage
    -- This is just a placeholder - in a real implementation,
    -- you'd need to set up a way to update the actual manifest.json file
    -- This would typically be done via a server-side process during build/deploy
    
    RETURN NEW;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to update manifest file when settings change
CREATE TRIGGER update_manifest_after_settings_change
AFTER INSERT OR UPDATE ON site_settings
FOR EACH ROW
EXECUTE FUNCTION update_manifest_file();

-- Insert default settings if not exists
INSERT INTO site_settings (id, site_name, site_description)
VALUES (1, 'store.fun', 'Merch Marketplace')
ON CONFLICT (id) DO NOTHING; 