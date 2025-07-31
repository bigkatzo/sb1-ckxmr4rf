-- Migration: Add base_currency column to products table
-- This migration adds the base_currency field to products for displaying the correct currency

-- Step 1: Add the base_currency column to the products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS base_currency TEXT DEFAULT 'sol';

-- Step 2: Add a check constraint to ensure valid currency values
ALTER TABLE products
ADD CONSTRAINT valid_base_currency CHECK (
    base_currency IS NULL OR 
    base_currency IN ('sol', 'usdc')
);

-- Step 3: Add description to the base_currency column
COMMENT ON COLUMN products.base_currency IS 'Base currency for the product price (sol or usdc)';

-- Step 4: Drop existing views with CASCADE to handle dependencies
DROP VIEW IF EXISTS merchant_products CASCADE;
DROP VIEW IF EXISTS public_products CASCADE;
DROP VIEW IF EXISTS public_products_with_categories CASCADE;

-- Step 5: Recreate merchant_products view with base_currency field
CREATE VIEW merchant_products AS
SELECT 
  p.id,
  p.name,
  p.sku,
  p.description,
  p.price,
  p.base_currency,
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
  p.blank_code,
  p.technique,
  p.note_for_supplier,
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

-- Step 6: Recreate public_products view with base_currency field
CREATE VIEW public_products AS
SELECT 
  p.id,
  p.name,
  p.description,
  p.price,
  p.base_currency,
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
  p.blank_code,
  p.technique,
  p.note_for_supplier,
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
LEFT JOIN categories cat ON cat.id = p.category_id
WHERE p.visible = true AND c.visible = true;

-- Step 7: Recreate public_products_with_categories view
CREATE VIEW public_products_with_categories AS
SELECT 
  p.id,
  p.name,
  p.sku,
  p.description,
  p.price,
  p.base_currency,
  p.images,
  p.quantity,
  p.minimum_order_quantity,
  p.category_id,
  p.variants,
  p.variant_prices,
  p.slug,
  c.id as collection_id,
  c.name as collection_name,
  c.slug as collection_slug,
  c.launch_date as collection_launch_date,
  c.sale_ended as collection_sale_ended,
  cat.name as category_name,
  cat.description as category_description,
  cat.type as category_type,
  cat.eligibility_rules as category_eligibility_rules
FROM products p
JOIN collections c ON c.id = p.collection_id
LEFT JOIN categories cat ON cat.id = p.category_id
WHERE c.visible = true
  AND (cat.id IS NULL OR cat.visible = true);

-- Step 8: Grant access to authenticated users
GRANT SELECT ON merchant_products TO authenticated;

-- Step 9: Grant access to anonymous users
GRANT SELECT ON public_products TO anon;
GRANT SELECT ON public_products_with_categories TO anon; 