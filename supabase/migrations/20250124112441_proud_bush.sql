-- Create function to validate image URLs
CREATE OR REPLACE FUNCTION validate_image_url(url text)
RETURNS boolean AS $$
BEGIN
  -- Basic URL validation
  IF url IS NULL OR url = '' THEN
    RETURN false;
  END IF;

  -- Check URL format
  IF NOT (
    url ~* '^https?://'
    AND (
      -- Allow common image domains
      url ~* '^https?://(.*\.)?unsplash\.com/'
      OR url ~* '^https?://(.*\.)?cloudinary\.com/'
      OR url ~* '^https?://(.*\.)?supabase\.co/'
      OR url ~* '^https?://(.*\.)?githubusercontent\.com/'
    )
  ) THEN
    RETURN false;
  END IF;

  -- Check file extension
  IF NOT (
    url ~* '\.(jpg|jpeg|png|gif|webp)$'
  ) THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create trigger function to validate collection images
CREATE OR REPLACE FUNCTION validate_collection_images()
RETURNS trigger AS $$
BEGIN
  -- Validate image_url if present
  IF NEW.image_url IS NOT NULL AND NOT validate_image_url(NEW.image_url) THEN
    RAISE EXCEPTION 'Invalid collection image URL format or domain';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to validate product images
CREATE OR REPLACE FUNCTION validate_product_images()
RETURNS trigger AS $$
BEGIN
  -- Validate each image URL in the array
  IF NEW.images IS NOT NULL THEN
    FOR i IN 1..array_length(NEW.images, 1) LOOP
      IF NOT validate_image_url(NEW.images[i]) THEN
        RAISE EXCEPTION 'Invalid product image URL at index %', i;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for image validation
DROP TRIGGER IF EXISTS validate_collection_images_trigger ON collections;
CREATE TRIGGER validate_collection_images_trigger
  BEFORE INSERT OR UPDATE ON collections
  FOR EACH ROW
  EXECUTE FUNCTION validate_collection_images();

DROP TRIGGER IF EXISTS validate_product_images_trigger ON products;
CREATE TRIGGER validate_product_images_trigger
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION validate_product_images();

-- Create function to verify image URLs
CREATE OR REPLACE FUNCTION verify_image_urls()
RETURNS TABLE (
  check_name text,
  status boolean,
  details text,
  invalid_urls text[]
) AS $$
DECLARE
  invalid_collection_images text[];
  invalid_product_images text[];
BEGIN
  -- Check collection images
  SELECT array_agg(image_url)
  INTO invalid_collection_images
  FROM collections
  WHERE image_url IS NOT NULL
  AND NOT validate_image_url(image_url);

  check_name := 'Collection image URLs';
  status := invalid_collection_images IS NULL;
  details := CASE 
    WHEN invalid_collection_images IS NULL THEN 'All collection image URLs are valid'
    ELSE 'Found invalid collection image URLs'
  END;
  invalid_urls := invalid_collection_images;
  RETURN NEXT;

  -- Check product images
  WITH product_images AS (
    SELECT unnest(images) as image_url
    FROM products
    WHERE images IS NOT NULL
  )
  SELECT array_agg(image_url)
  INTO invalid_product_images
  FROM product_images
  WHERE NOT validate_image_url(image_url);

  check_name := 'Product image URLs';
  status := invalid_product_images IS NULL;
  details := CASE 
    WHEN invalid_product_images IS NULL THEN 'All product image URLs are valid'
    ELSE 'Found invalid product image URLs'
  END;
  invalid_urls := invalid_product_images;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to fix broken image URLs
CREATE OR REPLACE FUNCTION fix_broken_images()
RETURNS void AS $$
BEGIN
  -- Update invalid collection images to null
  UPDATE collections
  SET image_url = NULL
  WHERE image_url IS NOT NULL
  AND NOT validate_image_url(image_url);

  -- Remove invalid product images
  UPDATE products
  SET images = array_remove(images, NULL)
  WHERE images IS NOT NULL;

  UPDATE products
  SET images = (
    SELECT array_agg(img)
    FROM unnest(images) img
    WHERE validate_image_url(img)
  )
  WHERE images IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to verify form data
CREATE OR REPLACE FUNCTION verify_form_data()
RETURNS TABLE (
  check_name text,
  status boolean,
  details text
) AS $$
BEGIN
  -- Check collection form data
  check_name := 'Collection form data';
  status := NOT EXISTS (
    SELECT 1 FROM collections
    WHERE name = ''
    OR description = ''
    OR launch_date IS NULL
  );
  details := 'All collection form fields are valid';
  RETURN NEXT;

  -- Check category form data
  check_name := 'Category form data';
  status := NOT EXISTS (
    SELECT 1 FROM categories
    WHERE name = ''
    OR description = ''
    OR type NOT IN ('blank', 'rules-based', 'whitelist')
  );
  details := 'All category form fields are valid';
  RETURN NEXT;

  -- Check product form data
  check_name := 'Product form data';
  status := NOT EXISTS (
    SELECT 1 FROM products
    WHERE name = ''
    OR description = ''
    OR price < 0
    OR quantity < 0
    OR sku IS NULL
    OR minimum_order_quantity < 1
  );
  details := 'All product form fields are valid';
  RETURN NEXT;

  -- Check order form data
  check_name := 'Order form data';
  status := NOT EXISTS (
    SELECT 1 FROM orders
    WHERE transaction_id = ''
    OR wallet_address = ''
    OR shipping_info IS NULL
    OR status NOT IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')
  );
  details := 'All order form fields are valid';
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION validate_image_url(text) TO authenticated;
GRANT EXECUTE ON FUNCTION verify_image_urls() TO authenticated;
GRANT EXECUTE ON FUNCTION fix_broken_images() TO authenticated;
GRANT EXECUTE ON FUNCTION verify_form_data() TO authenticated;