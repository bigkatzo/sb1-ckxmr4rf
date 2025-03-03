-- Start transaction
BEGIN;

-- Drop existing view first
DROP VIEW IF EXISTS merchant_orders;

-- Drop ALL existing policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "orders_select_buyer" ON orders;
  DROP POLICY IF EXISTS "orders_select_merchant" ON orders;
  DROP POLICY IF EXISTS "orders_update_merchant" ON orders;
  DROP POLICY IF EXISTS "orders_insert_authenticated" ON orders;
  DROP POLICY IF EXISTS "orders_view" ON orders;
  DROP POLICY IF EXISTS "orders_update" ON orders;
  DROP POLICY IF EXISTS "orders_insert" ON orders;
  DROP POLICY IF EXISTS "orders_policy" ON orders;
  DROP POLICY IF EXISTS "orders_merchant_view" ON orders;
  DROP POLICY IF EXISTS "orders_merchant_update" ON orders;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Create view policy for orders
CREATE POLICY "orders_view"
ON orders
FOR SELECT
TO authenticated
USING (
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
    WHERE c.id = orders.collection_id
    AND c.user_id = auth.uid()
  )
  OR
  -- Users with explicit access can view orders
  EXISTS (
    SELECT 1 FROM collection_access ca
    WHERE ca.collection_id = orders.collection_id
    AND ca.user_id = auth.uid()
    AND ca.access_type IN ('view', 'edit')
  )
  OR
  -- Buyers can view their own orders
  wallet_address = auth.jwt()->>'wallet_address'
);

-- Create update policy for orders
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
);

-- Create insert policy for orders
CREATE POLICY "orders_insert"
ON orders
FOR INSERT
TO authenticated
WITH CHECK (true);  -- Anyone authenticated can create orders

-- Create merchant_orders view to respect access rules
CREATE VIEW merchant_orders AS
SELECT 
  o.*,
  p.name as product_name,
  p.sku as product_sku,
  c.name as collection_name,
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
LEFT JOIN collection_access ca ON ca.collection_id = c.id AND ca.user_id = auth.uid()
WHERE 
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'admin'
  )
  OR c.user_id = auth.uid()
  OR ca.access_type IN ('view', 'edit')
  OR o.wallet_address = auth.jwt()->>'wallet_address';

-- Grant permissions
GRANT SELECT ON merchant_orders TO authenticated;

COMMIT; 