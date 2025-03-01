-- Start transaction
BEGIN;

-- Create orders table if it doesn't exist
CREATE TABLE IF NOT EXISTS orders (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    collection_id uuid REFERENCES collections(id) ON DELETE CASCADE,
    product_id uuid REFERENCES products(id) ON DELETE CASCADE,
    wallet_address text NOT NULL,
    transaction_signature text NOT NULL,
    shipping_address jsonb,
    contact_info jsonb,
    status text NOT NULL DEFAULT 'pending',
    amount_sol numeric(20,9) NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Create updated_at trigger
CREATE TRIGGER set_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_orders_collection_id ON orders(collection_id);
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_wallet_address ON orders(wallet_address);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Create public view for order counts (safe for anonymous users)
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

-- Create merchant dashboard view for orders
CREATE OR REPLACE VIEW merchant_orders AS
SELECT 
    o.*,
    p.name as product_name,
    c.name as collection_name,
    c.user_id as collection_owner_id,
    CASE 
        WHEN c.user_id = auth.uid() THEN NULL
        WHEN ca.access_type IS NOT NULL THEN ca.access_type
        ELSE NULL
    END as access_type
FROM orders o
JOIN products p ON p.id = o.product_id
JOIN collections c ON c.id = o.collection_id
LEFT JOIN collection_access ca ON ca.collection_id = c.id AND ca.user_id = auth.uid();

-- RLS Policies

-- 1. Public order count policy
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

-- 2. User's own orders policy
CREATE POLICY "orders_user_view"
ON orders
FOR SELECT
TO authenticated
USING (
    -- Users can view their own orders
    wallet_address = (
        SELECT wallet_address 
        FROM wallets w 
        WHERE w.user_id = auth.uid() 
        AND w.is_primary = true
        LIMIT 1
    )
);

-- 3. Merchant dashboard policies
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
)
WITH CHECK (
    -- Same conditions as USING clause
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

-- Grant permissions
GRANT SELECT ON public_order_counts TO public;
GRANT SELECT ON user_orders TO authenticated;
GRANT SELECT ON merchant_orders TO authenticated;

-- Add documentation
COMMENT ON TABLE orders IS 'Stores order information for products';
COMMENT ON VIEW public_order_counts IS 'Public view of order counts per product, only for visible collections';
COMMENT ON VIEW user_orders IS 'View of orders for the authenticated user''s wallet';
COMMENT ON VIEW merchant_orders IS 'View of orders for merchants based on collection access';

COMMIT; 