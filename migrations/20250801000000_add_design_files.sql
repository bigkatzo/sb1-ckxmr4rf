-- Add design_files column to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS design_files text[] DEFAULT '{}';

-- Update views that reference products table
DROP VIEW IF EXISTS merchant_products CASCADE;
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

-- Update public_products view to include design_files
DROP VIEW IF EXISTS public_products CASCADE;
CREATE VIEW public_products AS
SELECT 
  p.id,
  p.name,
  p.description,
  p.price,
  p.images,
  p.design_files,
  p.quantity,
  p.minimum_order_quantity,
  p.category_id,
  p.collection_id,
  p.variants,
  p.variant_prices,
  p.slug,
  p.visible,
  p.sale_ended,
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
WHERE p.visible = true
AND c.visible = true;

-- Update functions that create or update products
DROP FUNCTION IF EXISTS create_product_safely;
CREATE OR REPLACE FUNCTION create_product_safely(
  p_data jsonb
)
RETURNS products AS $$
DECLARE
  v_collection_id uuid;
  v_result products;
BEGIN
  -- Extract collection_id from data
  v_collection_id := (p_data->>'collection_id')::uuid;

  -- Verify collection ownership
  IF NOT EXISTS (
    SELECT 1 FROM collections
    WHERE id = v_collection_id
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: You do not own this collection';
  END IF;

  -- Insert product with retry logic
  FOR i IN 1..3 LOOP
    BEGIN
      INSERT INTO products (
        id,
        name,
        description,
        price,
        quantity,
        minimum_order_quantity,
        category_id,
        collection_id,
        images,
        design_files,
        variants,
        variant_prices,
        slug,
        sku,
        created_at
      )
      VALUES (
        COALESCE((p_data->>'id')::uuid, gen_random_uuid()),
        (p_data->>'name')::text,
        (p_data->>'description')::text,
        COALESCE((p_data->>'price')::numeric, 0),
        COALESCE((p_data->>'quantity')::integer, 0),
        COALESCE((p_data->>'minimum_order_quantity')::integer, 50),
        (p_data->>'category_id')::uuid,
        v_collection_id,
        COALESCE((p_data->>'images')::text[], '{}'),
        COALESCE((p_data->>'design_files')::text[], '{}'),
        COALESCE(p_data->'variants', '[]'::jsonb),
        COALESCE(p_data->'variant_prices', '{}'::jsonb),
        (p_data->>'slug')::text,
        (p_data->>'sku')::text,
        now()
      )
      RETURNING * INTO v_result;

      RETURN v_result;
    EXCEPTION WHEN OTHERS THEN
      IF i = 3 THEN RAISE; END IF;
      PERFORM pg_sleep(0.1 * i);
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 