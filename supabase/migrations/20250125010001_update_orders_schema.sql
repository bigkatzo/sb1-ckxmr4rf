-- Start transaction
BEGIN;

-- Drop existing policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "orders_select_buyer" ON orders;
  DROP POLICY IF EXISTS "orders_select_merchant" ON orders;
  DROP POLICY IF EXISTS "orders_update_merchant" ON orders;
  DROP POLICY IF EXISTS "orders_insert_authenticated" ON orders;
  DROP POLICY IF EXISTS "orders_count_public_view" ON orders;
  DROP POLICY IF EXISTS "orders_user_view" ON orders;
  DROP POLICY IF EXISTS "orders_merchant_view" ON orders;
  DROP POLICY IF EXISTS "orders_merchant_update" ON orders;
  DROP POLICY IF EXISTS "orders_insert" ON orders;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Add new columns
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS collection_id uuid REFERENCES collections(id) ON DELETE CASCADE;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS amount_sol numeric(20,9);

-- Drop old columns
ALTER TABLE orders
  DROP COLUMN IF EXISTS transaction_status;

ALTER TABLE orders
  DROP COLUMN IF EXISTS variants;

-- Add contact_info column
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS contact_info jsonb;

-- Update collection_id based on product's collection
UPDATE orders o
SET collection_id = p.collection_id
FROM products p
WHERE o.product_id = p.id
AND o.collection_id IS NULL;

-- Make collection_id NOT NULL after populating it
ALTER TABLE orders
  ALTER COLUMN collection_id SET NOT NULL;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_orders_collection_id ON orders(collection_id);
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_wallet_address ON orders(wallet_address);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Create public view for order counts
CREATE OR REPLACE VIEW public_order_counts AS
SELECT 
    p.id as product_id,
    p.collection_id,
    COUNT(o.id) as total_orders
FROM products p
LEFT JOIN orders o ON o.product_id = p.id
WHERE EXISTS (
    SELECT 1 FROM collections c
    WHERE c.id = p.collection_id
    AND c.visible = true
)
GROUP BY p.id, p.collection_id;

-- Create view for user's own orders
CREATE OR REPLACE VIEW user_orders AS
SELECT 
    o.id,
    o.collection_id,
    o.product_id,
    o.wallet_address,
    o.transaction_signature,
    o.shipping_address,
    o.contact_info,
    o.status,
    o.amount_sol,
    o.created_at,
    o.updated_at,
    p.name as product_name,
    c.name as collection_name
FROM orders o
JOIN products p ON p.id = o.product_id
JOIN collections c ON c.id = o.collection_id;

-- Drop existing view if it exists
DROP VIEW IF EXISTS merchant_orders CASCADE;

-- Create merchant dashboard view for orders
CREATE OR REPLACE VIEW merchant_orders AS
SELECT 
    o.*,
    p.name as product_name,
    p.sku as product_sku,
    p.images as product_images,
    c.name as collection_name,
    c.user_id as collection_owner_id,
    CASE 
        WHEN c.user_id = auth.uid() THEN 'edit'
        WHEN ca.access_type IS NOT NULL THEN ca.access_type
        ELSE NULL
    END as access_type
FROM orders o
JOIN products p ON p.id = o.product_id
JOIN collections c ON c.id = o.collection_id
LEFT JOIN collection_access ca ON ca.collection_id = c.id AND ca.user_id = auth.uid();

-- Create RLS policies
CREATE POLICY "orders_count_public_view"
ON orders
FOR SELECT
TO public
USING (
    EXISTS (
        SELECT 1 FROM collections c
        WHERE c.id = collection_id
        AND c.visible = true
    )
);

-- Add user orders policy
CREATE POLICY "orders_user_view"
ON orders
FOR SELECT
TO authenticated
USING (
    -- Users can only view their own orders
    wallet_address = auth.jwt()->>'wallet_address'
);

-- Add merchant orders policy with full access control
CREATE POLICY "orders_merchant_view"
ON orders
FOR SELECT
TO authenticated
USING (
    -- Collection owners can view orders
    EXISTS (
        SELECT 1 FROM collections c
        WHERE c.id = collection_id
        AND c.user_id = auth.uid()
    )
    OR
    -- Users with collection access can view orders
    EXISTS (
        SELECT 1 FROM collections c
        JOIN collection_access ca ON ca.collection_id = c.id
        WHERE c.id = collection_id
        AND ca.user_id = auth.uid()
        AND ca.access_type IN ('view', 'edit')
    )
    OR
    -- Admins can view all orders
    EXISTS (
        SELECT 1 FROM user_profiles up
        WHERE up.id = auth.uid()
        AND up.role = 'admin'
    )
);

CREATE POLICY "orders_merchant_update"
ON orders
FOR UPDATE
TO authenticated
USING (
    -- Collection owners can update orders
    EXISTS (
        SELECT 1 FROM collections c
        WHERE c.id = collection_id
        AND c.user_id = auth.uid()
    )
    OR
    -- Users with edit access can update orders
    EXISTS (
        SELECT 1 FROM collections c
        JOIN collection_access ca ON ca.collection_id = c.id
        WHERE c.id = collection_id
        AND ca.user_id = auth.uid()
        AND ca.access_type = 'edit'
    )
    OR
    -- Admins can update all orders
    EXISTS (
        SELECT 1 FROM user_profiles up
        WHERE up.id = auth.uid()
        AND up.role = 'admin'
    )
);

-- Add INSERT policy for orders
CREATE POLICY "orders_insert"
ON orders
FOR INSERT
TO authenticated
WITH CHECK (
    -- Only verify the product exists and is in a visible collection
    EXISTS (
        SELECT 1 FROM products p
        JOIN collections c ON c.id = p.collection_id
        WHERE p.id = product_id
        AND c.visible = true
    )
);

-- Grant permissions
GRANT SELECT ON public_order_counts TO public;
GRANT SELECT ON user_orders TO authenticated;
GRANT SELECT ON merchant_orders TO authenticated;
GRANT INSERT ON orders TO authenticated;

-- Add documentation
COMMENT ON TABLE orders IS 'Stores order information for products';
COMMENT ON VIEW public_order_counts IS 'Public view of order counts per product, only for visible collections';
COMMENT ON VIEW user_orders IS 'View of orders for the authenticated user''s wallet';
COMMENT ON VIEW merchant_orders IS 'View of orders for merchants based on collection access';

COMMIT; 