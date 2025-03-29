-- Start transaction
BEGIN;

-- Add order_number column if it doesn't exist
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS order_number text UNIQUE;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "merchant_orders_update" ON merchant_orders;
DROP POLICY IF EXISTS "merchant_orders_view" ON merchant_orders;

-- Drop the existing view
DROP VIEW IF EXISTS merchant_orders;

-- Recreate the view with security checks built in
CREATE OR REPLACE VIEW merchant_orders AS
SELECT 
  o.*,
  p.name as product_name,
  p.sku as product_sku,
  p.images[1] as product_image_url,
  p.variants as product_variants,
  p.variant_prices as product_variant_prices,
  c.name as collection_name,
  c.user_id as collection_owner_id,
  cat.name as category_name,
  cat.description as category_description,
  cat.type as category_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'admin'
    ) THEN 'admin'
    WHEN c.user_id = auth.uid() THEN 'owner'
    WHEN ca.access_type IS NOT NULL THEN ca.access_type
    ELSE NULL
  END as access_type
FROM orders o
JOIN products p ON p.id = o.product_id
JOIN collections c ON c.id = o.collection_id
LEFT JOIN categories cat ON cat.id = p.category_id
LEFT JOIN collection_access ca ON ca.collection_id = c.id AND ca.user_id = auth.uid()
WHERE (
  -- Admin can view all orders
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'admin'
  )
  OR
  -- Collection owners can view their orders
  EXISTS (
    SELECT 1 FROM collections c
    WHERE c.id = o.collection_id
    AND c.user_id = auth.uid()
  )
  OR
  -- Users with view/edit access can view orders
  EXISTS (
    SELECT 1 FROM collection_access ca
    WHERE ca.collection_id = o.collection_id
    AND ca.user_id = auth.uid()
    AND ca.access_type IN ('view', 'edit')
  )
);

-- Create or replace the update_merchant_order_status function
CREATE OR REPLACE FUNCTION update_merchant_order_status(
  p_order_id uuid,
  p_status text
)
RETURNS void AS $$
BEGIN
  -- Verify proper access to this order
  IF NOT EXISTS (
    SELECT 1 FROM orders o
    LEFT JOIN user_profiles up ON up.id = auth.uid()
    LEFT JOIN collection_access ca ON ca.collection_id = o.collection_id AND ca.user_id = auth.uid()
    LEFT JOIN collections c ON c.id = o.collection_id
    WHERE o.id = p_order_id
    AND (
      -- Admin access
      up.role = 'admin'
      OR 
      -- Collection owner
      c.user_id = auth.uid()
      OR 
      -- Edit access through collection_access
      ca.access_type = 'edit'
    )
  ) THEN
    RAISE EXCEPTION 'Access denied: Edit permission required to update order status';
  END IF;

  -- Verify status is valid
  IF p_status NOT IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid order status';
  END IF;

  -- Update order status
  UPDATE orders
  SET 
    status = p_status,
    updated_at = now()
  WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Commit transaction
COMMIT; 