-- Add order_number column to orders table
ALTER TABLE orders
ADD COLUMN order_number text UNIQUE;

-- Create sequence for order numbers
CREATE SEQUENCE IF NOT EXISTS order_number_seq;

-- Create function to generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS text AS $$
DECLARE
  year text;
  number text;
BEGIN
  year := to_char(current_timestamp, 'YY');
  number := lpad(nextval('order_number_seq')::text, 6, '0');
  RETURN 'ORD' || year || number;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically set order number
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS trigger AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_number_trigger
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_number();

-- Update get_merchant_orders function to include order_number
DROP FUNCTION IF EXISTS get_merchant_orders(int, int);
CREATE OR REPLACE FUNCTION get_merchant_orders(
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  order_number text,
  product_name text,
  product_sku text,
  product_price numeric,
  product_image text,
  collection_name text,
  category_name text,
  variants jsonb,
  shipping_info jsonb,
  transaction_id text,
  transaction_status text,
  wallet_address text,
  status text,
  created_at timestamptz,
  updated_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.order_number,
    p.name as product_name,
    p.sku as product_sku,
    p.price as product_price,
    COALESCE(
      (SELECT unnest(p.images) LIMIT 1),
      NULL
    ) as product_image,
    c.name as collection_name,
    cat.name as category_name,
    o.variants,
    o.shipping_info,
    o.transaction_id,
    o.transaction_status,
    o.wallet_address,
    o.status,
    o.created_at,
    o.updated_at
  FROM orders o
  JOIN products p ON p.id = o.product_id
  JOIN collections c ON c.id = p.collection_id
  LEFT JOIN categories cat ON cat.id = p.category_id
  WHERE c.user_id = auth.uid()
  ORDER BY o.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;