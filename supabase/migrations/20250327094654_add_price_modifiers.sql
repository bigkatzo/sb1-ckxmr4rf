-- Add price modifier columns to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS price_modifier_before_min numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS price_modifier_after_min numeric DEFAULT NULL;

-- Add check constraints to ensure valid modifier values
ALTER TABLE products
ADD CONSTRAINT valid_price_modifier_before CHECK (
    price_modifier_before_min IS NULL OR 
    (price_modifier_before_min >= -1 AND price_modifier_before_min <= 1)
),
ADD CONSTRAINT valid_price_modifier_after CHECK (
    price_modifier_after_min IS NULL OR 
    price_modifier_after_min >= 0
);

-- Update the product views to include the new fields
DROP VIEW IF EXISTS merchant_products;
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

DROP VIEW IF EXISTS public_products_with_categories;
CREATE VIEW public_products_with_categories AS
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
WHERE c.visible = true;

-- Grant permissions
GRANT SELECT ON merchant_products TO authenticated;
GRANT SELECT ON public_products_with_categories TO anon; 