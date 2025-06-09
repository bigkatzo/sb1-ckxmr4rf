-- Start transaction
BEGIN;

-- Create collection-logos bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('collection-logos', 'collection-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public can view collection logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload collection logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update collection logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete collection logos" ON storage.objects;

-- Create policy for public read access first
CREATE POLICY "Public can view collection logos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'collection-logos');

-- Create storage policies for collection-logos bucket
CREATE POLICY "Users can upload collection logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'collection-logos'
  AND (
    -- Check if user owns the collection
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id::text = (regexp_match(name, '^([^/]+)/'))[1]
      AND c.user_id = auth.uid()
    )
    OR
    -- Or if user has edit access to the collection
    EXISTS (
      SELECT 1 FROM collection_access ca
      WHERE ca.collection_id::text = (regexp_match(name, '^([^/]+)/'))[1]
      AND ca.user_id = auth.uid()
      AND ca.access_type = 'edit'
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

CREATE POLICY "Users can update collection logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'collection-logos'
  AND (
    -- Check if user owns the collection
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id::text = (regexp_match(name, '^([^/]+)/'))[1]
      AND c.user_id = auth.uid()
    )
    OR
    -- Or if user has edit access to the collection
    EXISTS (
      SELECT 1 FROM collection_access ca
      WHERE ca.collection_id::text = (regexp_match(name, '^([^/]+)/'))[1]
      AND ca.user_id = auth.uid()
      AND ca.access_type = 'edit'
    )
    OR
    -- Admins can update anywhere
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  )
);

CREATE POLICY "Users can delete collection logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'collection-logos'
  AND (
    -- Check if user owns the collection
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id::text = (regexp_match(name, '^([^/]+)/'))[1]
      AND c.user_id = auth.uid()
    )
    OR
    -- Or if user has edit access to the collection
    EXISTS (
      SELECT 1 FROM collection_access ca
      WHERE ca.collection_id::text = (regexp_match(name, '^([^/]+)/'))[1]
      AND ca.user_id = auth.uid()
      AND ca.access_type = 'edit'
    )
    OR
    -- Admins can delete anywhere
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  )
);

-- Add theme columns to collections table
ALTER TABLE collections
ADD COLUMN IF NOT EXISTS theme_primary_color text,
ADD COLUMN IF NOT EXISTS theme_secondary_color text,
ADD COLUMN IF NOT EXISTS theme_background_color text,
ADD COLUMN IF NOT EXISTS theme_text_color text,
ADD COLUMN IF NOT EXISTS theme_use_classic boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS theme_logo_url text;

-- Drop existing constraints if they exist
ALTER TABLE collections
DROP CONSTRAINT IF EXISTS valid_primary_color,
DROP CONSTRAINT IF EXISTS valid_secondary_color,
DROP CONSTRAINT IF EXISTS valid_background_color,
DROP CONSTRAINT IF EXISTS valid_text_color;

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
  END as access_type,
  -- Compute theme_use_custom based on whether any theme colors are set
  COALESCE(
    c.theme_primary_color IS NOT NULL OR 
    c.theme_secondary_color IS NOT NULL OR 
    c.theme_background_color IS NOT NULL OR 
    c.theme_text_color IS NOT NULL OR 
    c.theme_logo_url IS NOT NULL,
    false
  ) as theme_use_custom
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
    'theme_use_classic', theme_use_classic,
    'theme_logo_url', theme_logo_url,
    'theme_use_custom', COALESCE(
      theme_primary_color IS NOT NULL OR 
      theme_secondary_color IS NOT NULL OR 
      theme_background_color IS NOT NULL OR 
      theme_text_color IS NOT NULL OR 
      theme_logo_url IS NOT NULL,
      false
    )
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
        'theme_use_classic', c.theme_use_classic,
        'theme_logo_url', c.theme_logo_url,
        'theme_use_custom', COALESCE(
          c.theme_primary_color IS NOT NULL OR 
          c.theme_secondary_color IS NOT NULL OR 
          c.theme_background_color IS NOT NULL OR 
          c.theme_text_color IS NOT NULL OR 
          c.theme_logo_url IS NOT NULL,
          false
        )
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

  -- Verify storage bucket exists
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets 
    WHERE id = 'collection-logos'
  ) THEN
    RAISE EXCEPTION 'Collection logos bucket not created';
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

-- Recreate the storefront functions
DROP FUNCTION IF EXISTS public.get_featured_collections();
DROP FUNCTION IF EXISTS public.get_upcoming_collections();
DROP FUNCTION IF EXISTS public.get_latest_collections();

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
  WHERE launch_date <= now()
  ORDER BY launch_date DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.get_featured_collections() TO anon;
GRANT EXECUTE ON FUNCTION public.get_upcoming_collections() TO anon;
GRANT EXECUTE ON FUNCTION public.get_latest_collections(integer, integer) TO anon;

-- Add explicit comments for better documentation
COMMENT ON FUNCTION public.get_featured_collections() IS 'Returns featured collections that are visible to the public';
COMMENT ON FUNCTION public.get_upcoming_collections() IS 'Returns upcoming collections that are visible to the public';
COMMENT ON FUNCTION public.get_latest_collections(integer, integer) IS 'Returns latest collections with pagination support for infinite scrolling';

COMMIT; 