-- Migration to restore and fix product_snapshot data
BEGIN;

-- First, initialize any NULL product_snapshots to empty objects
UPDATE orders
SET product_snapshot = '{}'::jsonb
WHERE product_snapshot IS NULL;

-- Add URLs to existing product snapshots without overwriting other data
-- This uses jsonb_set to only modify the specific fields we want to add
UPDATE orders o
SET product_snapshot = jsonb_set(
  jsonb_set(
    o.product_snapshot,
    '{product_url}',
    to_jsonb(
      CASE 
        WHEN c.slug IS NOT NULL AND p.slug IS NOT NULL THEN 
          'https://store.fun/' || c.slug || '/' || p.slug
        ELSE 
          'https://store.fun/products/' || o.product_id
      END
    )
  ),
  '{design_url}',
  to_jsonb(
    CASE 
      WHEN c.slug IS NOT NULL AND p.slug IS NOT NULL THEN 
        'https://store.fun/' || c.slug || '/' || p.slug || '/design'
      ELSE 
        'https://store.fun/products/' || o.product_id || '/design'
    END
  )
)
FROM products p
LEFT JOIN collections c ON c.id = p.collection_id
WHERE p.id = o.product_id;

-- Add the manufacturing fields to existing product snapshots if they exist in the products table
UPDATE orders o
SET product_snapshot = jsonb_set(
  o.product_snapshot,
  '{blank_code}',
  to_jsonb(p.blank_code)
)
FROM products p
WHERE p.id = o.product_id
AND p.blank_code IS NOT NULL
AND (o.product_snapshot->>'blank_code' IS NULL);

UPDATE orders o
SET product_snapshot = jsonb_set(
  o.product_snapshot,
  '{technique}',
  to_jsonb(p.technique)
)
FROM products p
WHERE p.id = o.product_id
AND p.technique IS NOT NULL
AND (o.product_snapshot->>'technique' IS NULL);

UPDATE orders o
SET product_snapshot = jsonb_set(
  o.product_snapshot,
  '{note_for_supplier}',
  to_jsonb(p.note_for_supplier)
)
FROM products p
WHERE p.id = o.product_id
AND p.note_for_supplier IS NOT NULL
AND (o.product_snapshot->>'note_for_supplier' IS NULL);

UPDATE orders o
SET product_snapshot = jsonb_set(
  o.product_snapshot,
  '{design_files}',
  to_jsonb(p.design_files)
)
FROM products p
WHERE p.id = o.product_id
AND p.design_files IS NOT NULL
AND (o.product_snapshot->'design_files' IS NULL);

-- For orders where the product is gone but we have product_id,
-- set placeholder URLs in the product_snapshot
UPDATE orders o
SET product_snapshot = jsonb_set(
  jsonb_set(
    o.product_snapshot,
    '{product_url}',
    to_jsonb('https://store.fun/products/' || o.product_id)
  ),
  '{design_url}',
  to_jsonb('https://store.fun/products/' || o.product_id || '/design')
)
WHERE o.product_id IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM products p WHERE p.id = o.product_id)
AND o.product_snapshot IS NOT NULL
AND (o.product_snapshot->>'product_url' IS NULL OR o.product_snapshot->>'design_url' IS NULL);

-- Update the save_order_snapshots function to be more resilient
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

COMMIT; 