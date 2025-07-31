-- Add base_currency field to public_products_with_categories view
-- This fixes the price display issue in collection grid and best sellers

BEGIN;

-- Drop the existing view with CASCADE to handle dependencies
DROP VIEW IF EXISTS public_products_with_categories CASCADE;

-- Recreate the public_products_with_categories view with base_currency field
CREATE VIEW public_products_with_categories AS
SELECT 
  p.id,
  p.name,
  p.description,
  p.price,
  p.base_currency,
  p.images,
  COALESCE(p.design_files, ARRAY[]::text[]) as design_files,
  p.quantity,
  p.minimum_order_quantity,
  p.category_id,
  p.collection_id,
  p.variants,
  p.variant_prices,
  p.slug,
  p.visible,
  COALESCE(p.sale_ended, false) as sale_ended,
  p.pin_order,
  p.blank_code,
  p.technique,
  p.note_for_supplier,
  p.created_at,
  c.name as collection_name,
  c.slug as collection_slug,
  c.launch_date as collection_launch_date,
  COALESCE(c.sale_ended, false) as collection_sale_ended,
  c.user_id as collection_user_id,
  up.merchant_tier as collection_owner_merchant_tier,
  cat.name as category_name,
  cat.description as category_description,
  cat.type as category_type,
  cat.eligibility_rules as category_eligibility_rules,
  COALESCE(cat.sale_ended, false) as category_sale_ended,
  COALESCE(p.notes->>'shipping', '') as shipping_notes,
  COALESCE(p.notes->>'quality', '') as quality_notes,
  COALESCE(p.notes->>'returns', '') as returns_notes,
  p.free_notes,
  p.price_modifier_before_min,
  p.price_modifier_after_min,
  0 as sales_count
FROM products p
JOIN collections c ON c.id = p.collection_id
LEFT JOIN categories cat ON cat.id = p.category_id
LEFT JOIN user_profiles up ON up.id = c.user_id
WHERE p.visible = true
  AND COALESCE(c.visible, true) = true
  AND (cat.id IS NULL OR COALESCE(cat.visible, true) = true);

-- Grant permissions on the view
GRANT SELECT ON public_products_with_categories TO anon;

COMMIT; 