-- Create function to debug product images
CREATE OR REPLACE FUNCTION debug_product_images(p_sku text)
RETURNS TABLE (
  image_index int,
  image_url text,
  is_valid boolean,
  validation_error text
) AS $$
DECLARE
  v_images text[];
BEGIN
  -- Get product images
  SELECT images INTO v_images
  FROM products
  WHERE sku = p_sku;

  -- Return validation results for each image
  IF v_images IS NOT NULL THEN
    FOR i IN 1..array_length(v_images, 1) LOOP
      image_index := i;
      image_url := v_images[i];
      is_valid := validate_image_url(v_images[i]);
      validation_error := CASE
        WHEN v_images[i] IS NULL THEN 'Image URL is null'
        WHEN v_images[i] = '' THEN 'Image URL is empty'
        WHEN NOT (v_images[i] ~* '^https?://') THEN 'Invalid URL format'
        WHEN NOT (
          v_images[i] ~* '^https?://(.*\.)?unsplash\.com/' OR
          v_images[i] ~* '^https?://(.*\.)?cloudinary\.com/' OR
          v_images[i] ~* '^https?://(.*\.)?supabase\.co/' OR
          v_images[i] ~* '^https?://(.*\.)?githubusercontent\.com/' OR
          v_images[i] ~* '^https?://(.*\.)?images\.unsplash\.com/' OR
          v_images[i] ~* '^https?://(.*\.)?plus\.unsplash\.com/' OR
          v_images[i] ~* '^https?://(.*\.)?raw\.githubusercontent\.com/' OR
          v_images[i] ~* '^https?://sakysysfksculqobozxi\.supabase\.co/' OR
          v_images[i] ~* '^https?://[a-z0-9-]+\.supabase\.co/' OR
          v_images[i] ~* '^https?://[a-z0-9-]+\.cloudinary\.com/'
        ) THEN 'Invalid domain'
        WHEN NOT (
          v_images[i] ~* '\.(jpg|jpeg|png|gif|webp|avif)([?#].*)?$' OR
          v_images[i] ~* '/image/' OR
          v_images[i] ~* '/photo/' OR
          v_images[i] ~* '/storage/v1/object/public/'
        ) THEN 'Invalid file type or path'
        ELSE NULL
      END;
      RETURN NEXT;
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to fix product images
CREATE OR REPLACE FUNCTION fix_product_images(p_sku text)
RETURNS TABLE (
  action text,
  details text
) AS $$
DECLARE
  v_product_id uuid;
  v_old_images text[];
  v_new_images text[];
  v_removed_count int;
BEGIN
  -- Get product info
  SELECT id, images INTO v_product_id, v_old_images
  FROM products
  WHERE sku = p_sku;

  IF NOT FOUND THEN
    action := 'ERROR';
    details := 'Product not found';
    RETURN NEXT;
    RETURN;
  END IF;

  -- Filter valid images
  SELECT array_agg(img)
  INTO v_new_images
  FROM unnest(v_old_images) img
  WHERE validate_image_url(img);

  -- Calculate removed count
  v_removed_count := array_length(v_old_images, 1) - COALESCE(array_length(v_new_images, 1), 0);

  -- Update product
  UPDATE products
  SET images = COALESCE(v_new_images, '{}')
  WHERE id = v_product_id;

  -- Return results
  action := 'UPDATE';
  details := format('Removed %s invalid images. Old count: %s, New count: %s', 
    v_removed_count,
    array_length(v_old_images, 1),
    COALESCE(array_length(v_new_images, 1), 0)
  );
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION debug_product_images(text) TO authenticated;
GRANT EXECUTE ON FUNCTION fix_product_images(text) TO authenticated;

-- Debug IQ6900 product images
SELECT * FROM debug_product_images('IQ6900');

-- Fix IQ6900 product images
SELECT * FROM fix_product_images('IQ6900');