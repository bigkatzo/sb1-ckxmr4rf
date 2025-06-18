-- Fix merchant_products view to include missing advanced fields
-- The merchant dashboard uses this view but it's missing the advanced fields

BEGIN;

-- Drop the existing view with CASCADE to handle dependencies
DROP VIEW IF EXISTS merchant_products CASCADE;

-- Recreate the merchant_products view with all fields including advanced ones
-- Based on the most recent structure from other migrations
CREATE VIEW merchant_products AS
SELECT 
  p.id,
  p.name,
  p.sku,
  p.description,
  p.price,
  p.images,
  p.design_files,
  p.quantity,
  p.minimum_order_quantity,
  p.category_id,
  p.variants,
  p.variant_prices,
  p.slug,
  p.price_modifier_before_min,
  p.price_modifier_after_min,
  p.visible,
  p.sale_ended,
  p.notes,
  p.free_notes,
  p.pin_order,
  -- MISSING ADVANCED FIELDS - ADD THESE:
  p.blank_code,
  p.technique,
  p.note_for_supplier,
  -- END OF ADVANCED FIELDS
  c.id as collection_id,
  c.name as collection_name,
  c.slug as collection_slug,
  c.launch_date as collection_launch_date,
  c.sale_ended as collection_sale_ended,
  c.visible as collection_visible,
  cat.name as category_name,
  cat.description as category_description,
  cat.type as category_type,
  cat.eligibility_rules as category_eligibility_rules,
  cat.sale_ended as category_sale_ended,
  cat.visible as category_visible
FROM products p
JOIN collections c ON c.id = p.collection_id
LEFT JOIN categories cat ON cat.id = p.category_id;

-- Recreate the get_merchant_products function if it exists
-- Check if the function exists and recreate it to prevent breakage
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_merchant_products') THEN
    -- Drop existing function
    DROP FUNCTION IF EXISTS get_merchant_products(uuid);
    
    -- Recreate function
    CREATE OR REPLACE FUNCTION get_merchant_products(merchant_id uuid)
    RETURNS SETOF merchant_products AS $func$
    BEGIN
      RETURN QUERY
      SELECT mp.*
      FROM merchant_products mp
      JOIN collection_merchants cm ON cm.collection_id = mp.collection_id
      WHERE cm.merchant_id = $1;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;
    
    -- Grant permissions
    GRANT EXECUTE ON FUNCTION get_merchant_products(uuid) TO authenticated;
  END IF;
END $$;

-- Grant appropriate permissions on the view
GRANT SELECT ON merchant_products TO authenticated;

COMMIT; 