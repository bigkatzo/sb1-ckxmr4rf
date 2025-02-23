-- Create storefront views that ONLY expose public data
CREATE VIEW public_collections AS
SELECT 
  id,
  name,
  description,
  image_url,
  launch_date,
  featured,
  visible,
  sale_ended,
  slug
FROM collections
WHERE visible = true;

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
  p.variant_stock,
  p.slug,
  c.id as collection_id,
  c.name as collection_name,
  c.slug as collection_slug,
  c.launch_date as collection_launch_date,
  c.sale_ended as collection_sale_ended
FROM products p
JOIN collections c ON c.id = p.collection_id
WHERE c.visible = true;

CREATE VIEW public_categories AS
SELECT 
  cat.id,
  cat.name,
  cat.description,
  cat.type,
  cat.eligibility_rules,
  cat.collection_id
FROM categories cat
JOIN collections c ON c.id = cat.collection_id
WHERE c.visible = true;

-- Grant access to the public views
GRANT SELECT ON public_collections TO anon;
GRANT SELECT ON public_products TO anon;
GRANT SELECT ON public_categories TO anon;

-- Revoke direct table access from anon role
REVOKE SELECT ON collections FROM anon;
REVOKE SELECT ON products FROM anon;
REVOKE SELECT ON categories FROM anon;

-- Create helper functions for the storefront
CREATE OR REPLACE FUNCTION get_featured_collections()
RETURNS SETOF public_collections AS $$
  SELECT * FROM public_collections
  WHERE featured = true
  ORDER BY launch_date DESC;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_upcoming_collections()
RETURNS SETOF public_collections AS $$
  SELECT * FROM public_collections
  WHERE launch_date > now()
  ORDER BY launch_date ASC;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_latest_collections()
RETURNS SETOF public_collections AS $$
  SELECT * FROM public_collections
  WHERE launch_date <= now()
  AND sale_ended = false
  ORDER BY launch_date DESC;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_best_sellers(p_limit integer DEFAULT 6)
RETURNS SETOF public_products AS $$
  SELECT * FROM public_products
  WHERE collection_sale_ended = false
  ORDER BY quantity DESC
  LIMIT p_limit;
$$ LANGUAGE sql SECURITY DEFINER;

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION get_featured_collections() TO anon;
GRANT EXECUTE ON FUNCTION get_upcoming_collections() TO anon;
GRANT EXECUTE ON FUNCTION get_latest_collections() TO anon;
GRANT EXECUTE ON FUNCTION get_best_sellers(integer) TO anon; 