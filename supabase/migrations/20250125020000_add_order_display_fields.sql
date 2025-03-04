-- Add display fields to orders table
ALTER TABLE orders
ADD COLUMN product_name text,
ADD COLUMN product_sku text,
ADD COLUMN collection_name text;

-- Update existing orders with product and collection info
UPDATE orders o
SET 
  product_name = p.name,
  product_sku = p.sku,
  collection_name = c.name
FROM products p
JOIN collections c ON c.id = p.collection_id
WHERE p.id = o.product_id;

-- Update merchant_orders view to use new fields
CREATE OR REPLACE VIEW merchant_orders AS
SELECT 
  o.id,
  o.order_number,
  o.product_id,
  -- Use direct fields instead of joins
  o.product_name,
  o.product_sku,
  o.product_image_url,
  o.product_variants,
  o.product_variant_prices,
  o.collection_id,
  o.collection_name,
  -- Keep collection owner for access control
  c.user_id as collection_owner_id,
  -- Keep category info for filtering/display
  cat.name as category_name,
  cat.description as category_description,
  cat.type as category_type,
  o.wallet_address,
  o.transaction_signature,
  o.shipping_address,
  o.contact_info,
  o.status,
  o.amount_sol,
  o.created_at,
  o.updated_at,
  o.variant_selections,
  -- Access type logic
  CASE 
    WHEN auth.uid() = c.user_id THEN 'owner'
    WHEN EXISTS (
      SELECT 1 FROM user_profiles up 
      WHERE up.id = auth.uid() 
      AND up.role = 'admin'
    ) THEN 'admin'
    WHEN EXISTS (
      SELECT 1 FROM collection_access ca 
      WHERE ca.collection_id = c.id 
      AND ca.user_id = auth.uid()
    ) THEN (
      SELECT ca.access_type 
      FROM collection_access ca 
      WHERE ca.collection_id = c.id 
      AND ca.user_id = auth.uid()
      LIMIT 1
    )
    ELSE NULL
  END as access_type,
  o.product_snapshot,
  o.collection_snapshot
FROM orders o
JOIN collections c ON c.id = o.collection_id
LEFT JOIN products p ON p.id = o.product_id
LEFT JOIN categories cat ON cat.id = p.category_id
WHERE (
  -- User is admin
  EXISTS (
    SELECT 1 FROM user_profiles up 
    WHERE up.id = auth.uid() 
    AND up.role = 'admin'
  )
  -- User owns the collection
  OR c.user_id = auth.uid()
  -- User has access through collection_access
  OR EXISTS (
    SELECT 1 FROM collection_access ca 
    WHERE ca.collection_id = c.id 
    AND ca.user_id = auth.uid()
  )
);

-- Add trigger to automatically set display fields on insert/update
CREATE OR REPLACE FUNCTION set_order_display_fields()
RETURNS trigger AS $$
BEGIN
  -- Get product and collection info
  SELECT 
    p.name,
    p.sku,
    c.name
  INTO
    NEW.product_name,
    NEW.product_sku,
    NEW.collection_name
  FROM products p
  JOIN collections c ON c.id = p.collection_id
  WHERE p.id = NEW.product_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_display_fields_trigger
BEFORE INSERT OR UPDATE OF product_id ON orders
FOR EACH ROW
EXECUTE FUNCTION set_order_display_fields(); 