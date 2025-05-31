-- Add new columns to the products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS pin_order SMALLINT,
ADD COLUMN IF NOT EXISTS blank_code TEXT,
ADD COLUMN IF NOT EXISTS technique TEXT,
ADD COLUMN IF NOT EXISTS note_for_supplier TEXT;

-- Add description to the pin_order column
COMMENT ON COLUMN products.pin_order IS 'Position for pinned products (1, 2, 3) or null if not pinned';

-- Add description to the blank_code column
COMMENT ON COLUMN products.blank_code IS 'Code for the blank product used in manufacturing';

-- Add description to the technique column
COMMENT ON COLUMN products.technique IS 'Manufacturing technique used for the product';

-- Add description to the note_for_supplier column
COMMENT ON COLUMN products.note_for_supplier IS 'Special notes for the supplier about this product';

-- Update all views that use the products table

-- 1. Update public.public_products view to include new fields
CREATE OR REPLACE VIEW public.public_products AS
SELECT 
  p.id,
  p.created_at,
  p.updated_at,
  p.name,
  p.description,
  p.price,
  p.stock,
  p.collection_id,
  p.category_id,
  p.images,
  p.design_files,
  p.variants,
  p.variant_prices,
  p.sku,
  p.visible,
  p.slug,
  p.minimum_order_quantity,
  p.notes,
  p.sale_ended,
  p.free_notes,
  p.price_modifier_before_min,
  p.price_modifier_after_min,
  p.pin_order,
  p.blank_code,
  p.technique,
  p.note_for_supplier,
  cat.name AS category_name,
  cat.visible AS category_visible,
  cat.sale_ended AS category_sale_ended,
  col.name AS collection_name,
  col.visible AS collection_visible,
  col.sale_ended AS collection_sale_ended,
  col.launch_date AS collection_launch_date,
  col.slug AS collection_slug
FROM 
  products p
  LEFT JOIN categories cat ON p.category_id = cat.id
  LEFT JOIN collections col ON p.collection_id = col.id
WHERE 
  p.visible = true 
  AND cat.visible = true 
  AND col.visible = true;

-- 2. Update merchant_products view to include new fields
CREATE OR REPLACE VIEW public.merchant_products AS
SELECT 
  p.id,
  p.created_at,
  p.updated_at,
  p.name,
  p.description,
  p.price,
  p.stock,
  p.collection_id,
  p.category_id,
  p.images,
  p.design_files,
  p.variants,
  p.variant_prices,
  p.sku,
  p.visible,
  p.slug,
  p.minimum_order_quantity,
  p.notes,
  p.sale_ended,
  p.free_notes,
  p.price_modifier_before_min,
  p.price_modifier_after_min,
  p.pin_order,
  p.blank_code,
  p.technique,
  p.note_for_supplier,
  cat.name AS category_name,
  cat.visible AS category_visible,
  cat.sale_ended AS category_sale_ended,
  col.name AS collection_name,
  col.visible AS collection_visible,
  col.sale_ended AS collection_sale_ended,
  col.launch_date AS collection_launch_date,
  col.slug AS collection_slug
FROM 
  products p
  LEFT JOIN categories cat ON p.category_id = cat.id
  LEFT JOIN collections col ON p.collection_id = col.id;

-- Pin order constraint (can only be 1, 2, 3, or null)
ALTER TABLE products 
ADD CONSTRAINT pin_order_values
CHECK (pin_order IS NULL OR pin_order BETWEEN 1 AND 3); 