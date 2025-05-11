-- Start transaction
BEGIN;

-- Add URL fields to collections table
ALTER TABLE collections
ADD COLUMN IF NOT EXISTS custom_url text,
ADD COLUMN IF NOT EXISTS x_url text,
ADD COLUMN IF NOT EXISTS telegram_url text,
ADD COLUMN IF NOT EXISTS dexscreener_url text,
ADD COLUMN IF NOT EXISTS pumpfun_url text,
ADD COLUMN IF NOT EXISTS website_url text;

-- Verify changes
DO $$
BEGIN
  -- Check if columns were added
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'collections'
    AND column_name = 'custom_url'
  ) THEN
    RAISE EXCEPTION 'Failed to add custom_url column';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'collections'
    AND column_name = 'x_url'
  ) THEN
    RAISE EXCEPTION 'Failed to add x_url column';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'collections'
    AND column_name = 'telegram_url'
  ) THEN
    RAISE EXCEPTION 'Failed to add telegram_url column';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'collections'
    AND column_name = 'dexscreener_url'
  ) THEN
    RAISE EXCEPTION 'Failed to add dexscreener_url column';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'collections'
    AND column_name = 'pumpfun_url'
  ) THEN
    RAISE EXCEPTION 'Failed to add pumpfun_url column';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'collections'
    AND column_name = 'website_url'
  ) THEN
    RAISE EXCEPTION 'Failed to add website_url column';
  END IF;
END $$;

-- Commit transaction
COMMIT; 