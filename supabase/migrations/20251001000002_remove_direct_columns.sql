-- Migration to remove direct manufacturing columns and use snapshots exclusively
BEGIN;

-- First, ensure all data is in the product_snapshot
-- Add manufacturing fields to any snapshots that might be missing them
UPDATE orders o
SET product_snapshot = jsonb_set(
  o.product_snapshot,
  '{blank_code}',
  to_jsonb(o.blank_code)
)
WHERE o.blank_code IS NOT NULL
AND (o.product_snapshot IS NULL OR o.product_snapshot->>'blank_code' IS NULL);

UPDATE orders o
SET product_snapshot = jsonb_set(
  o.product_snapshot,
  '{technique}',
  to_jsonb(o.technique)
)
WHERE o.technique IS NOT NULL
AND (o.product_snapshot IS NULL OR o.product_snapshot->>'technique' IS NULL);

UPDATE orders o
SET product_snapshot = jsonb_set(
  o.product_snapshot,
  '{note_for_supplier}',
  to_jsonb(o.note_for_supplier)
)
WHERE o.note_for_supplier IS NOT NULL
AND (o.product_snapshot IS NULL OR o.product_snapshot->>'note_for_supplier' IS NULL);

UPDATE orders o
SET product_snapshot = jsonb_set(
  o.product_snapshot,
  '{design_files}',
  to_jsonb(o.design_files)
)
WHERE o.design_files IS NOT NULL
AND (o.product_snapshot IS NULL OR o.product_snapshot->'design_files' IS NULL);

-- Update the save_order_snapshots function to remove setting of direct columns
CREATE OR REPLACE FUNCTION save_order_snapshots()
RETURNS trigger AS $$
DECLARE
  v_product_slug TEXT;
  v_collection_slug TEXT;
  v_base_url TEXT := 'https://store.fun';
  v_product_url TEXT;
  v_design_url TEXT;
BEGIN
  -- Save product snapshot (if product exists)
  IF NEW.product_id IS NOT NULL THEN
    -- Get slugs for URL construction - with LEFT JOIN to handle missing collections
    SELECT p.slug, c.slug 
    INTO v_product_slug, v_collection_slug
    FROM products p
    LEFT JOIN collections c ON c.id = p.collection_id
    WHERE p.id = NEW.product_id;
    
    -- Build complete URLs for snapshot only
    v_product_url := CASE 
      WHEN v_collection_slug IS NOT NULL AND v_product_slug IS NOT NULL THEN 
        v_base_url || '/' || v_collection_slug || '/' || v_product_slug
      ELSE 
        v_base_url || '/products/' || NEW.product_id
    END;
    
    v_design_url := CASE 
      WHEN v_collection_slug IS NOT NULL AND v_product_slug IS NOT NULL THEN 
        v_base_url || '/' || v_collection_slug || '/' || v_product_slug || '/design'
      ELSE 
        v_base_url || '/products/' || NEW.product_id || '/design'
    END;
    
    -- Create the product snapshot with all fields including URLs and manufacturing details
    SELECT jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'sku', p.sku,
      'description', p.description,
      'images', p.images,
      'variants', p.variants,
      'variant_prices', p.variant_prices,
      'blank_code', p.blank_code,
      'technique', p.technique,
      'note_for_supplier', p.note_for_supplier,
      'design_files', p.design_files,
      'slug', p.slug,
      'product_url', v_product_url,
      'design_url', v_design_url,
      'category', (
        SELECT jsonb_build_object('id', c.id, 'name', c.name) 
        FROM categories c 
        WHERE c.id = p.category_id
      )
    ) INTO NEW.product_snapshot
    FROM products p
    WHERE p.id = NEW.product_id;
  END IF;

  -- Save collection snapshot (if collection exists)
  IF NEW.collection_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'description', c.description,
      'owner_id', c.user_id,
      'slug', c.slug
    ) INTO NEW.collection_snapshot
    FROM collections c
    WHERE c.id = NEW.collection_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Now drop the direct columns from the orders table
ALTER TABLE orders
DROP COLUMN IF EXISTS blank_code,
DROP COLUMN IF EXISTS technique,
DROP COLUMN IF EXISTS note_for_supplier,
DROP COLUMN IF EXISTS design_files;

COMMIT; 