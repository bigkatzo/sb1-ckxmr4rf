-- Start transaction
BEGIN;

-- Drop existing function
DROP FUNCTION IF EXISTS update_order_status(uuid, text);

-- Create updated function with proper access control
CREATE OR REPLACE FUNCTION update_order_status(
  p_order_id uuid,
  p_status text
)
RETURNS void AS $$
BEGIN
  -- Verify proper access to this order
  IF NOT EXISTS (
    SELECT 1 FROM orders o
    JOIN products p ON p.id = o.product_id
    JOIN collections c ON c.id = p.collection_id
    LEFT JOIN collection_access ca ON ca.collection_id = c.id AND ca.user_id = auth.uid()
    LEFT JOIN user_profiles up ON up.id = auth.uid()
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

-- Drop existing policies
DROP POLICY IF EXISTS "orders_update" ON orders;
DROP POLICY IF EXISTS "orders_dashboard_modify" ON orders;
DROP POLICY IF EXISTS "orders_merchant_update" ON orders;

-- Create new update policy
CREATE POLICY "orders_update"
ON orders
FOR UPDATE
TO authenticated
USING (
  -- Admin can update all orders
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'admin'
  )
  OR
  -- Collection owners can update their orders
  EXISTS (
    SELECT 1 FROM collections c
    WHERE c.id = orders.collection_id
    AND c.user_id = auth.uid()
  )
  OR
  -- Users with edit access can update orders
  EXISTS (
    SELECT 1 FROM collection_access ca
    WHERE ca.collection_id = orders.collection_id
    AND ca.user_id = auth.uid()
    AND ca.access_type = 'edit'
  )
)
WITH CHECK (
  -- Same conditions as USING clause
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'admin'
  )
  OR
  EXISTS (
    SELECT 1 FROM collections c
    WHERE c.id = orders.collection_id
    AND c.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM collection_access ca
    WHERE ca.collection_id = orders.collection_id
    AND ca.user_id = auth.uid()
    AND ca.access_type = 'edit'
  )
);

COMMIT; 