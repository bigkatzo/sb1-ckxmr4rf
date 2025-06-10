-- Start transaction
BEGIN;

-- Drop views to remove constraints
DROP VIEW IF EXISTS public_collections CASCADE;
DROP VIEW IF EXISTS merchant_collections CASCADE;

-- Add the new column first
ALTER TABLE collections ADD COLUMN IF NOT EXISTS theme_use_custom boolean DEFAULT true;

-- Debug info
DO $$
DECLARE
    v_collection_exists boolean;
    v_first_user_id uuid;
    v_collection_id uuid := '876f6ed7-507b-4668-ab05-cbe9f4d060b4';
    v_collection_record collections%ROWTYPE;
    v_rowcount int;
    v_trigger_enabled boolean;
BEGIN
    -- First check if we can get a valid user ID
    SELECT id INTO v_first_user_id 
    FROM auth.users 
    ORDER BY created_at ASC
    LIMIT 1;
    
    IF v_first_user_id IS NULL THEN
        RAISE NOTICE 'ERROR: Could not find any users in auth.users table';
        RETURN;
    END IF;
    
    RAISE NOTICE 'First user ID found: %', v_first_user_id;

    -- Check collection current state
    SELECT * INTO v_collection_record
    FROM collections 
    WHERE id = v_collection_id;
    
    IF NOT FOUND THEN
        RAISE NOTICE 'ERROR: Collection % not found', v_collection_id;
        RETURN;
    END IF;
    
    RAISE NOTICE 'Current collection state:';
    RAISE NOTICE 'ID: %, Name: %, User ID: %', 
        v_collection_record.id, 
        v_collection_record.name, 
        v_collection_record.user_id;

    -- Try direct update first
    BEGIN
        UPDATE collections 
        SET user_id = v_first_user_id
        WHERE id = v_collection_id;
        
        GET DIAGNOSTICS v_rowcount = ROW_COUNT;
        RAISE NOTICE 'Direct update affected % rows', v_rowcount;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Direct update failed: %', SQLERRM;
    END;

    -- Check if update worked
    SELECT user_id INTO v_collection_record.user_id
    FROM collections 
    WHERE id = v_collection_id;
    
    RAISE NOTICE 'Final user_id state: %', v_collection_record.user_id;
END $$;

-- Recreate views
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

COMMIT; 