-- Create function to safely handle product updates
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
        quantity = COALESCE((p_data->>'quantity')::integer, quantity),
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
      PERFORM pg_sleep(0.1 * i); -- Exponential backoff
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to safely handle category updates
CREATE OR REPLACE FUNCTION update_category_safely(
  p_category_id uuid,
  p_data jsonb
)
RETURNS categories AS $$
DECLARE
  v_collection_id uuid;
  v_result categories;
BEGIN
  -- Get collection ID and verify ownership
  SELECT collection_id INTO v_collection_id
  FROM categories
  WHERE id = p_category_id;

  IF NOT EXISTS (
    SELECT 1 FROM collections
    WHERE id = v_collection_id
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: You do not own this collection';
  END IF;

  -- Update category with retry logic
  FOR i IN 1..3 LOOP
    BEGIN
      UPDATE categories
      SET
        name = COALESCE((p_data->>'name')::text, name),
        description = COALESCE((p_data->>'description')::text, description),
        type = COALESCE((p_data->>'type')::text, type),
        eligibility_rules = COALESCE(p_data->'eligibility_rules', eligibility_rules),
        updated_at = now()
      WHERE id = p_category_id
      RETURNING * INTO v_result;

      RETURN v_result;
    EXCEPTION WHEN OTHERS THEN
      IF i = 3 THEN RAISE; END IF;
      PERFORM pg_sleep(0.1 * i);
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to safely handle collection updates
CREATE OR REPLACE FUNCTION update_collection_safely(
  p_collection_id uuid,
  p_data jsonb
)
RETURNS collections AS $$
DECLARE
  v_result collections;
BEGIN
  -- Verify ownership
  IF NOT EXISTS (
    SELECT 1 FROM collections
    WHERE id = p_collection_id
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: You do not own this collection';
  END IF;

  -- Update collection with retry logic
  FOR i IN 1..3 LOOP
    BEGIN
      UPDATE collections
      SET
        name = COALESCE((p_data->>'name')::text, name),
        description = COALESCE((p_data->>'description')::text, description),
        image_url = COALESCE((p_data->>'image_url')::text, image_url),
        launch_date = COALESCE((p_data->>'launch_date')::timestamptz, launch_date),
        visible = COALESCE((p_data->>'visible')::boolean, visible),
        featured = COALESCE((p_data->>'featured')::boolean, featured),
        updated_at = now()
      WHERE id = p_collection_id
      RETURNING * INTO v_result;

      RETURN v_result;
    EXCEPTION WHEN OTHERS THEN
      IF i = 3 THEN RAISE; END IF;
      PERFORM pg_sleep(0.1 * i);
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;