-- Start transaction
BEGIN;

-- Create collection_assets bucket if it doesn't exist
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('collection-assets', 'collection-assets', true)
  ON CONFLICT (id) DO NOTHING;
END $$;

-- Add storage policy for collection assets
DO $$
BEGIN
  -- Drop existing policies to avoid conflicts
  DROP POLICY IF EXISTS "Collection owners can upload assets" ON storage.objects;
  DROP POLICY IF EXISTS "Anyone can view collection assets" ON storage.objects;
  
  -- Create policies
  CREATE POLICY "Collection owners can upload assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'collection-assets'
    AND (
      -- Extract collection ID from path (format: collection_id/file.ext)
      EXISTS (
        SELECT 1 FROM collections
        WHERE id::text = SPLIT_PART(name, '/', 1)
        AND user_id = auth.uid()
      )
      OR
      -- Admins can upload anywhere
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid()
        AND role = 'admin'
      )
    )
  );

  CREATE POLICY "Anyone can view collection assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'collection-assets');
END $$;

-- Add theme columns to collections table
ALTER TABLE collections
ADD COLUMN IF NOT EXISTS theme_primary_color text,
ADD COLUMN IF NOT EXISTS theme_secondary_color text,
ADD COLUMN IF NOT EXISTS theme_background_color text,
ADD COLUMN IF NOT EXISTS theme_text_color text,
ADD COLUMN IF NOT EXISTS theme_use_custom boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS theme_use_classic boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS theme_logo_url text;

-- Add check constraints for valid hex colors
ALTER TABLE collections
ADD CONSTRAINT valid_primary_color CHECK (
  theme_primary_color IS NULL OR theme_primary_color ~ '^#[0-9a-fA-F]{6}$'
),
ADD CONSTRAINT valid_secondary_color CHECK (
  theme_secondary_color IS NULL OR theme_secondary_color ~ '^#[0-9a-fA-F]{6}$'
),
ADD CONSTRAINT valid_background_color CHECK (
  theme_background_color IS NULL OR theme_background_color ~ '^#[0-9a-fA-F]{6}$'
),
ADD CONSTRAINT valid_text_color CHECK (
  theme_text_color IS NULL OR theme_text_color ~ '^#[0-9a-fA-F]{6}$'
);

-- Update public_collections view to include theme fields
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
  theme_use_custom,
  theme_use_classic,
  theme_logo_url
FROM collections
WHERE visible = true;

-- Update merchant_collections view to include theme fields
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

-- Create function to get collection theme
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
    'theme_use_custom', theme_use_custom,
    'theme_use_classic', theme_use_classic,
    'theme_logo_url', theme_logo_url
  )
  INTO theme_data
  FROM collections
  WHERE id = collection_id
  AND visible = true;

  RETURN theme_data;
END;
$$;

-- Update product_snapshots to include collection theme
CREATE OR REPLACE FUNCTION update_order_snapshots()
RETURNS trigger AS $$
DECLARE
  v_base_url text := 'https://store.fun';
  v_product_url text;
  v_design_url text;
  v_product_slug text;
  v_collection_slug text;
BEGIN
  -- Save product snapshot (if product exists)
  IF NEW.product_id IS NOT NULL THEN
    -- Get slugs for URL construction
    SELECT p.slug, c.slug, jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'description', c.description,
      'owner_id', c.user_id,
      'slug', c.slug,
      'theme', jsonb_build_object(
        'theme_primary_color', c.theme_primary_color,
        'theme_secondary_color', c.theme_secondary_color,
        'theme_background_color', c.theme_background_color,
        'theme_text_color', c.theme_text_color,
        'theme_use_custom', c.theme_use_custom,
        'theme_use_classic', c.theme_use_classic,
        'theme_logo_url', c.theme_logo_url
      )
    )
    INTO v_product_slug, v_collection_slug, NEW.collection_snapshot
    FROM products p
    LEFT JOIN collections c ON c.id = p.collection_id
    WHERE p.id = NEW.product_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Verify changes
DO $$
BEGIN
  -- Verify theme columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'collections' 
    AND column_name = 'theme_primary_color'
  ) THEN
    RAISE EXCEPTION 'Theme columns not added correctly';
  END IF;

  -- Verify storage bucket
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets 
    WHERE id = 'collection-assets'
  ) THEN
    RAISE EXCEPTION 'Collection assets bucket not created';
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