-- Add triggers to automatically refresh the materialized view when product data changes
BEGIN;

-- Create a simple trigger function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_trending_products_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Simply call the existing refresh function
  PERFORM refresh_trending_products();
  RETURN NULL;
END;
$$;

-- Add trigger for product changes (INSERT, UPDATE, DELETE)
DROP TRIGGER IF EXISTS refresh_trending_products_product_trigger ON products;
CREATE TRIGGER refresh_trending_products_product_trigger
AFTER INSERT OR UPDATE OR DELETE ON products
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_trending_products_trigger();

-- Add trigger for order changes (since they affect product rankings)
DROP TRIGGER IF EXISTS refresh_trending_products_order_trigger ON orders;
CREATE TRIGGER refresh_trending_products_order_trigger
AFTER INSERT OR UPDATE OF status, product_id ON orders
FOR EACH STATEMENT
EXECUTE FUNCTION refresh_trending_products_trigger();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION refresh_trending_products_trigger() TO postgres;

COMMIT; 