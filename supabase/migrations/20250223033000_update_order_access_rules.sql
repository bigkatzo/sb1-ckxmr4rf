-- Start transaction
BEGIN;

-- Drop existing merchant dashboard policies
DROP POLICY IF EXISTS "orders_merchant_view" ON orders;
DROP POLICY IF EXISTS "orders_merchant_update" ON orders;

-- Drop and recreate the view
DROP VIEW IF EXISTS merchant_orders;

-- Create new dashboard policies that match collection access pattern
CREATE POLICY "orders_dashboard_view"
ON orders
FOR SELECT
TO authenticated
USING (
    -- Admins can view all orders
    EXISTS (
        SELECT 1 FROM user_profiles up
        WHERE up.id = auth.uid()
        AND up.role = 'admin'
    )
    OR
    -- Collection owners can view orders for their collections
    EXISTS (
        SELECT 1 FROM collections c
        WHERE c.id = collection_id
        AND c.user_id = auth.uid()
    )
    OR
    -- Users with collection access (view/edit) can view orders
    EXISTS (
        SELECT 1 FROM collections c
        JOIN collection_access ca ON ca.collection_id = c.id
        WHERE c.id = collection_id
        AND ca.user_id = auth.uid()
        AND ca.access_type IN ('view', 'edit')
    )
);

CREATE POLICY "orders_dashboard_modify"
ON orders
FOR UPDATE
TO authenticated
USING (
    -- Admins can modify all orders
    EXISTS (
        SELECT 1 FROM user_profiles up
        WHERE up.id = auth.uid()
        AND up.role = 'admin'
    )
    OR
    -- Collection owners can modify orders for their collections
    EXISTS (
        SELECT 1 FROM collections c
        WHERE c.id = collection_id
        AND c.user_id = auth.uid()
    )
    OR
    -- Users with edit access can modify orders
    EXISTS (
        SELECT 1 FROM collections c
        JOIN collection_access ca ON ca.collection_id = c.id
        WHERE c.id = collection_id
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
);

-- Create the updated view
CREATE VIEW merchant_orders AS
SELECT 
    o.*,
    p.name as product_name,
    c.name as collection_name,
    c.user_id as collection_owner_id,
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
LEFT JOIN collection_access ca ON ca.collection_id = c.id AND ca.user_id = auth.uid();

-- Add indexes to optimize policy performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_admin ON user_profiles(id) WHERE role = 'admin';
CREATE INDEX IF NOT EXISTS idx_collection_access_user_type ON collection_access(user_id, access_type);

-- Grant permissions on the new view
GRANT SELECT ON merchant_orders TO authenticated;

COMMIT; 