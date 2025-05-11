-- Start transaction
BEGIN;

-- Drop existing views
DROP VIEW IF EXISTS public_collections CASCADE;
DROP VIEW IF EXISTS public_user_profiles CASCADE;

-- Create a secure view for public user profiles
-- This only exposes safe fields and not sensitive information
CREATE VIEW public_user_profiles AS
SELECT 
  id,
  display_name,
  description,
  profile_image,
  website_url
FROM user_profiles;

-- Recreate the view with URL fields and user_id
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
  website_url
FROM collections
WHERE visible = true;

-- Grant access to the updated views
GRANT SELECT ON public_collections TO anon;
GRANT SELECT ON public_user_profiles TO anon;

-- Verify the views were created correctly
DO $$
BEGIN
  -- Check if views exist and contain all fields
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'public_collections'
    AND column_name = 'user_id'
  ) THEN
    RAISE EXCEPTION 'Field user_id missing from public_collections view';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'public_collections'
    AND column_name = 'custom_url'
  ) THEN
    RAISE EXCEPTION 'Field custom_url missing from public_collections view';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'public_collections'
    AND column_name = 'x_url'
  ) THEN
    RAISE EXCEPTION 'Field x_url missing from public_collections view';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'public_collections'
    AND column_name = 'telegram_url'
  ) THEN
    RAISE EXCEPTION 'Field telegram_url missing from public_collections view';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'public_collections'
    AND column_name = 'dexscreener_url'
  ) THEN
    RAISE EXCEPTION 'Field dexscreener_url missing from public_collections view';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'public_collections'
    AND column_name = 'pumpfun_url'
  ) THEN
    RAISE EXCEPTION 'Field pumpfun_url missing from public_collections view';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'public_collections'
    AND column_name = 'website_url'
  ) THEN
    RAISE EXCEPTION 'Field website_url missing from public_collections view';
  END IF;
  
  -- Check public_user_profiles has only the allowed fields
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'public_user_profiles'
    AND column_name = 'display_name'
  ) THEN
    RAISE EXCEPTION 'Field display_name missing from public_user_profiles view';
  END IF;
  
  -- Ensure sensitive fields are not included
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'public_user_profiles'
    AND column_name = 'email'
  ) THEN
    RAISE EXCEPTION 'Sensitive field email should not be included in public_user_profiles view';
  END IF;
  
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'public_user_profiles'
    AND column_name = 'wallet_address'
  ) THEN
    RAISE EXCEPTION 'Sensitive field wallet_address should not be included in public_user_profiles view';
  END IF;
END $$;

-- Commit transaction
COMMIT; 