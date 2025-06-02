-- Migration to update product snapshots with URLs and manufacturing details
BEGIN;

-- DO NOT add any direct columns to the orders table
-- All data will be stored in the product_snapshot

-- Update the save_order_snapshots function to include all fields in the snapshot only
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
    -- Get slugs for URL construction
    SELECT p.slug, c.slug 
    INTO v_product_slug, v_collection_slug
    FROM products p
    JOIN collections c ON c.id = p.collection_id
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

-- Update existing product snapshots to include URLs and manufacturing details
UPDATE orders o
SET product_snapshot = 
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              COALESCE(o.product_snapshot, '{}'::jsonb),
              '{blank_code}',
              to_jsonb(COALESCE(p.blank_code, null))
            ),
            '{technique}',
            to_jsonb(COALESCE(p.technique, null))
          ),
          '{note_for_supplier}',
          to_jsonb(COALESCE(p.note_for_supplier, null))
        ),
        '{design_files}',
        to_jsonb(COALESCE(p.design_files, null))
      ),
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
JOIN collections c ON c.id = p.collection_id
WHERE p.id = o.product_id
AND o.product_snapshot IS NOT NULL;

COMMIT; 