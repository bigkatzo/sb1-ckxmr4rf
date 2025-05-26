-- Add theme_use_classic column to site_settings table
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS theme_use_classic BOOLEAN DEFAULT TRUE;

-- Update the default settings record if it exists
UPDATE site_settings 
SET theme_use_classic = TRUE
WHERE id = 1; 