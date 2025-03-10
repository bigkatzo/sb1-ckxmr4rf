-- Modify products table to use NULL for unlimited stock
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_quantity_check;
ALTER TABLE products ALTER COLUMN quantity DROP NOT NULL;
ALTER TABLE products ALTER COLUMN quantity SET DEFAULT NULL;
ALTER TABLE products ADD CONSTRAINT products_quantity_check CHECK (quantity IS NULL OR quantity >= 0);

-- Update existing products with -1 quantity to use NULL instead
UPDATE products SET quantity = NULL WHERE quantity = -1;

-- Update create_product_safely function to handle NULL quantities
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
        (p_data->>'quantity')::integer,  -- Allow NULL for unlimited stock
        COALESCE((p_data->>'minimum_order_quantity')::integer, 50),
        (p_data->>'category_id')::uuid,
        v_collection_id,
        COALESCE((p_data->>'images')::text[], '{}'),
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

-- Update update_product_safely function to handle NULL quantities
CREATE OR REPLACE FUNCTION update_product_safely(
  p_product_id uuid,
  p_data jsonb
)
RETURNS products AS $$
DECLARE
  v_collection_id uuid;
  v_result products;
BEGIN
  -- Get collection ID and verify ownership
  SELECT collection_id INTO v_collection_id
  FROM products
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  -- Verify collection ownership
  IF NOT EXISTS (
    SELECT 1 FROM collections
    WHERE id = v_collection_id
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: You do not own this collection';
  END IF;

  -- Update product with retry logic
  FOR i IN 1..3 LOOP
    BEGIN
      UPDATE products
      SET
        name = COALESCE((p_data->>'name')::text, name),
        description = COALESCE((p_data->>'description')::text, description),
        price = COALESCE((p_data->>'price')::numeric, price),
        quantity = CASE 
          WHEN p_data ? 'quantity' THEN (p_data->>'quantity')::integer
          ELSE quantity
        END,
        minimum_order_quantity = COALESCE((p_data->>'minimum_order_quantity')::integer, minimum_order_quantity),
        category_id = COALESCE((p_data->>'category_id')::uuid, category_id),
        images = COALESCE((p_data->>'images')::text[], images),
        variants = COALESCE(p_data->'variants', variants),
        variant_prices = COALESCE(p_data->'variant_prices', variant_prices),
        updated_at = now()
      WHERE id = p_product_id
      RETURNING * INTO v_result;

      RETURN v_result;
    EXCEPTION WHEN OTHERS THEN
      IF i = 3 THEN RAISE; END IF;
      PERFORM pg_sleep(0.1 * i);
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or replace function to handle product data validation
CREATE OR REPLACE FUNCTION validate_product_data()
RETURNS trigger AS $$
BEGIN
  -- Initialize empty objects if null
  IF NEW.variant_prices IS NULL THEN
    NEW.variant_prices := '{}'::jsonb;
  END IF;

  -- Validate variants structure
  IF NEW.variants IS NOT NULL THEN
    IF NOT (
      SELECT bool_and(
        jsonb_typeof(elem->'id') = 'string' AND
        jsonb_typeof(elem->'name') = 'string' AND
        jsonb_typeof(elem->'options') = 'array' AND
        (
          SELECT bool_and(
            jsonb_typeof(opt->'id') = 'string' AND
            jsonb_typeof(opt->'value') = 'string'
          )
          FROM jsonb_array_elements(elem->'options') opt
        )
      )
      FROM jsonb_array_elements(NEW.variants) elem
    ) THEN
      RAISE EXCEPTION 'Invalid variant structure';
    END IF;
  END IF;

  -- Validate variant prices
  IF NEW.variant_prices IS NOT NULL THEN
    IF NOT (
      SELECT bool_and(
        jsonb_typeof(value) = 'number' AND 
        (value::text)::numeric >= 0
      )
      FROM jsonb_each(NEW.variant_prices)
    ) THEN
      RAISE EXCEPTION 'All variant prices must be non-negative numbers';
    END IF;
  END IF;

  -- Ensure minimum_order_quantity is valid
  IF NEW.minimum_order_quantity < 1 THEN
    NEW.minimum_order_quantity := 50;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql; 