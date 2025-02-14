-- Add default ordering for all tables
ALTER TABLE collections 
  ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE products
  ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE categories
  ALTER COLUMN created_at SET DEFAULT now();

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_collections_created_at ON collections(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_categories_created_at ON categories(created_at DESC);

-- Create helper functions that include proper ordering
CREATE OR REPLACE FUNCTION get_product_by_id(p_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  price numeric,
  images text[],
  category_id uuid,
  collection_id uuid,
  variants jsonb,
  variant_prices jsonb,
  quantity integer,
  minimum_order_quantity integer,
  slug text,
  sku text,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT p.*
  FROM products p
  WHERE p.id = p_id
  ORDER BY p.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_collection_by_id(p_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  image_url text,
  launch_date timestamptz,
  visible boolean,
  featured boolean,
  slug text,
  user_id uuid,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT c.*
  FROM collections c
  WHERE c.id = p_id
  ORDER BY c.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_category_by_id(p_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  type text,
  collection_id uuid,
  eligibility_rules jsonb,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT c.*
  FROM categories c
  WHERE c.id = p_id
  ORDER BY c.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;