-- Add sale_ended column to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS sale_ended boolean NOT NULL DEFAULT false;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_products_sale_ended
ON products(sale_ended)
WHERE sale_ended = true;

-- Create function to toggle product sale ended status
CREATE OR REPLACE FUNCTION toggle_product_sale_ended(
  p_product_id uuid,
  p_sale_ended boolean
)
RETURNS void AS $$
BEGIN
  UPDATE products
  SET 
    sale_ended = p_sale_ended,
    updated_at = now()
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update merchant_products view to include sale_ended
DROP VIEW IF EXISTS merchant_products CASCADE;
CREATE VIEW merchant_products AS
SELECT 
  p.id,
  p.name,
  p.sku,
  p.description,
  p.price,
  p.images,
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
LEFT JOIN categories cat ON cat.id = p.category_id;

-- Update public_products view to include sale_ended
DROP VIEW IF EXISTS public_products CASCADE;
CREATE VIEW public_products AS
SELECT 
  p.id,
  p.name,
  p.sku,
  p.description,
  p.price,
  p.images,
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
WHERE p.visible = true AND c.visible = true;

-- Recreate any dependent views if needed
DROP VIEW IF EXISTS public_products_with_categories CASCADE;
CREATE VIEW public_products_with_categories AS
SELECT 
  p.*,
  c.eligibility_rules as category_rules
FROM public_products p
LEFT JOIN categories c ON c.id = p.category_id; 