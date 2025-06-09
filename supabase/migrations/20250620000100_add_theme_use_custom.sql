-- Start transaction
BEGIN;

-- Add theme_use_custom column to collections table
ALTER TABLE collections
ADD COLUMN IF NOT EXISTS theme_use_custom boolean DEFAULT false;

-- Update existing collections to set theme_use_custom based on theme fields
UPDATE collections 
SET theme_use_custom = COALESCE(
  theme_primary_color IS NOT NULL OR 
  theme_secondary_color IS NOT NULL OR 
  theme_background_color IS NOT NULL OR 
  theme_text_color IS NOT NULL OR 
  theme_logo_url IS NOT NULL,
  false
);

-- Update public_collections view to use the actual column
DROP VIEW IF EXISTS public_collections CASCADE;
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
  theme_primary_color,
  theme_secondary_color,
  theme_background_color,
  theme_text_color,
  theme_use_classic,
  theme_logo_url,
  theme_use_custom
FROM collections
WHERE visible = true;

-- Update merchant_collections view to use the actual column
DROP VIEW IF EXISTS merchant_collections CASCADE;
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

-- Update get_collection_theme function to use the actual column
CREATE OR REPLACE FUNCTION get_collection_theme(collection_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  theme_data jsonb;
BEGIN
  SELECT jsonb_build_object(
    'theme_primary_color', theme_primary_color,
    'theme_secondary_color', theme_secondary_color,
    'theme_background_color', theme_background_color,
    'theme_text_color', theme_text_color,
    'theme_use_classic', theme_use_classic,
    'theme_logo_url', theme_logo_url,
    'theme_use_custom', theme_use_custom
  )
  INTO theme_data
  FROM collections
  WHERE id = collection_id
  AND visible = true;

  RETURN theme_data;
END;
$$;

-- Verify changes
DO $$
BEGIN
  -- Verify theme_use_custom column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'collections' 
    AND column_name = 'theme_use_custom'
  ) THEN
    RAISE EXCEPTION 'theme_use_custom column not added correctly';
  END IF;

  -- Verify views
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_name = 'public_collections'
  ) THEN
    RAISE EXCEPTION 'Public collections view not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_name = 'merchant_collections'
  ) THEN
    RAISE EXCEPTION 'Merchant collections view not created';
  END IF;
END $$;

COMMIT; 