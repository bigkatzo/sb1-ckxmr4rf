-- Migration: Add notes and free_notes columns to products table
-- This migration adds structured notes and free-form notes fields to products
-- for display in product modals without affecting order functionality

-- Step 1: Add the new columns to the products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS notes JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS free_notes TEXT DEFAULT NULL;

-- Step 2: Add a check constraint to ensure notes has the expected structure (optional)
ALTER TABLE products
ADD CONSTRAINT valid_notes_structure CHECK (
  notes IS NULL OR 
  (
    jsonb_typeof(notes) = 'object' AND
    (NOT jsonb_exists(notes, 'shipping') OR jsonb_typeof(notes->'shipping') = 'string') AND
    (NOT jsonb_exists(notes, 'quality') OR jsonb_typeof(notes->'quality') = 'string') AND
    (NOT jsonb_exists(notes, 'returns') OR jsonb_typeof(notes->'returns') = 'string')
  )
);

-- Step 3: Drop existing views with CASCADE to handle dependencies
DROP VIEW IF EXISTS merchant_products CASCADE;
DROP VIEW IF EXISTS public_products CASCADE;
DROP VIEW IF EXISTS public_products_with_categories CASCADE;

-- Step 4: Recreate merchant_products view with notes fields
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

-- Step 5: Recreate public_products view with notes fields
CREATE VIEW public_products AS
SELECT 
  p.id,
  p.name,
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
  p.notes,
  p.free_notes,
  c.id as collection_id,
  c.name as collection_name,
  c.slug as collection_slug,
  c.launch_date as collection_launch_date,
  c.sale_ended as collection_sale_ended
FROM products p
JOIN collections c ON c.id = p.collection_id
LEFT JOIN categories cat ON cat.id = p.category_id
WHERE c.visible = true 
  AND p.visible = true
  AND (cat.id IS NULL OR cat.visible = true);

-- Step 6: Recreate public_products_with_categories view with notes fields
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
WHERE c.visible = true 
  AND p.visible = true
  AND (cat.id IS NULL OR cat.visible = true);

-- Step 7: Recreate the get_merchant_products function to maintain dependencies
CREATE OR REPLACE FUNCTION get_merchant_products(merchant_id uuid)
RETURNS SETOF merchant_products AS $$
BEGIN
  RETURN QUERY
  SELECT mp.*
  FROM merchant_products mp
  JOIN collection_merchants cm ON cm.collection_id = mp.collection_id
  WHERE cm.merchant_id = $1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 8: Recreate best sellers functions
-- Drop old functions
DROP FUNCTION IF EXISTS get_best_sellers(integer);
DROP FUNCTION IF EXISTS get_best_sellers(integer, text);
DROP FUNCTION IF EXISTS get_best_sellers_v2(integer, text);

-- Create best sellers function with original signature
CREATE OR REPLACE FUNCTION get_best_sellers(p_limit integer DEFAULT 6, p_sort_by text DEFAULT 'sales')
RETURNS SETOF public_products_with_categories AS $$
BEGIN
  RETURN QUERY
  SELECT p.*
  FROM public_products_with_categories p
  LEFT JOIN (
    SELECT product_id, COUNT(*) as order_count
    FROM orders
    GROUP BY product_id
  ) o ON o.product_id = p.id
  WHERE p.collection_launch_date <= NOW()
    AND NOT p.collection_sale_ended
  ORDER BY 
    CASE 
      WHEN p_sort_by = 'sales' THEN COALESCE(o.order_count, 0)
      ELSE p.quantity 
    END DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create best sellers function with new signature
CREATE OR REPLACE FUNCTION get_best_sellers_v2(limit_count integer DEFAULT 10, collection_slug text DEFAULT NULL)
RETURNS SETOF public_products_with_categories AS $$
BEGIN
  RETURN QUERY
  SELECT p.*
  FROM public_products_with_categories p
  LEFT JOIN (
    SELECT product_id, COUNT(*) as order_count
    FROM orders
    GROUP BY product_id
  ) o ON o.product_id = p.id
  WHERE (collection_slug IS NULL OR p.collection_slug = collection_slug)
    AND p.collection_launch_date <= NOW()
    AND NOT p.collection_sale_ended
  ORDER BY COALESCE(o.order_count, 0) DESC, p.collection_launch_date DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 9: Grant permissions
GRANT SELECT ON merchant_products TO authenticated;
GRANT SELECT ON public_products TO anon;
GRANT SELECT ON public_products_with_categories TO anon;
GRANT EXECUTE ON FUNCTION get_merchant_products(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_best_sellers(integer, text) TO anon;
GRANT EXECUTE ON FUNCTION get_best_sellers_v2(integer, text) TO anon; 