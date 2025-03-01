-- Start transaction
BEGIN;

-- Drop existing views
DROP VIEW IF EXISTS user_orders CASCADE;
DROP VIEW IF EXISTS merchant_orders CASCADE;

-- Recreate user orders view without filtering
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

-- Recreate merchant orders view without filtering
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

-- Drop existing policies
DO $$ BEGIN
    DROP POLICY IF EXISTS "orders_user_view" ON orders;
    DROP POLICY IF EXISTS "orders_merchant_view" ON orders;
    DROP POLICY IF EXISTS "orders_merchant_update" ON orders;
    DROP POLICY IF EXISTS "orders_count_public_view" ON orders;
    DROP POLICY IF EXISTS "orders_insert" ON orders;
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

-- Recreate RLS policies
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

CREATE POLICY "orders_user_view"
ON orders
FOR SELECT
TO authenticated
USING (
    -- Users can only view their own orders
    wallet_address = auth.jwt()->>'wallet_address'
);

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
GRANT SELECT ON user_orders TO authenticated;
GRANT SELECT ON merchant_orders TO authenticated;

COMMIT; 