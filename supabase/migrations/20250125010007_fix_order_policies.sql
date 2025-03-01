-- Start transaction
BEGIN;

-- Drop existing policies
DROP POLICY IF EXISTS "orders_user_view" ON orders;
DROP POLICY IF EXISTS "orders_select_buyer" ON orders;
DROP POLICY IF EXISTS "orders_merchant_view" ON orders;
DROP POLICY IF EXISTS "orders_merchant_update" ON orders;
DROP POLICY IF EXISTS "orders_insert" ON orders;

-- Create updated policies using JWT wallet address consistently
CREATE POLICY "orders_user_view"
ON orders
FOR SELECT
TO authenticated
USING (
    -- Users can view their own orders by matching wallet address from JWT
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
    EXISTS (
        SELECT 1 FROM collections c
        WHERE c.id = collection_id
        AND c.user_id = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1 FROM collections c
        JOIN collection_access ca ON ca.collection_id = c.id
        WHERE c.id = collection_id
        AND ca.user_id = auth.uid()
        AND ca.access_type = 'edit'
    )
    OR
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
    -- Verify wallet address matches JWT
    wallet_address = auth.jwt()->>'wallet_address'
    AND
    -- Only verify the product exists and is in a visible collection
    EXISTS (
        SELECT 1 FROM products p
        JOIN collections c ON c.id = p.collection_id
        WHERE p.id = product_id
        AND c.visible = true
    )
);

COMMIT; 