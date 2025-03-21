-- Start transaction
BEGIN;

-- Create order_products table if it doesn't exist
CREATE TABLE IF NOT EXISTS order_products (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
    product_id uuid REFERENCES products(id) ON DELETE RESTRICT,
    quantity integer NOT NULL DEFAULT 1,
    price_at_time numeric(10,2) NOT NULL,
    variant_id uuid,
    variant_data jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_order_products_order_id ON order_products(order_id);
CREATE INDEX IF NOT EXISTS idx_order_products_product_id ON order_products(product_id);

-- Add RLS policies
ALTER TABLE order_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_products_select_policy" ON order_products
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM orders o
            JOIN products p ON p.id = order_products.product_id
            JOIN collections c ON c.id = p.collection_id
            LEFT JOIN collection_access ca ON ca.collection_id = c.id AND ca.user_id = auth.uid()
            WHERE o.id = order_products.order_id
            AND (
                c.user_id = auth.uid()
                OR ca.access_type IN ('view', 'edit')
                OR EXISTS (
                    SELECT 1 FROM user_profiles up
                    WHERE up.id = auth.uid()
                    AND up.role = 'admin'
                )
            )
        )
    );

-- Update merchant_orders view to include order products
DROP VIEW IF EXISTS merchant_orders;
CREATE VIEW merchant_orders AS
SELECT 
    o.*,
    jsonb_agg(
        jsonb_build_object(
            'id', op.id,
            'product_id', op.product_id,
            'quantity', op.quantity,
            'price_at_time', op.price_at_time,
            'variant_data', op.variant_data,
            'product', jsonb_build_object(
                'name', p.name,
                'sku', p.sku,
                'collection_name', c.name
            )
        )
    ) FILTER (WHERE op.id IS NOT NULL) as products
FROM orders o
LEFT JOIN order_products op ON op.order_id = o.id
LEFT JOIN products p ON p.id = op.product_id
LEFT JOIN collections c ON c.id = p.collection_id
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
        SELECT 1 FROM collections c2
        WHERE c2.id = c.id
        AND c2.user_id = auth.uid()
    )
    OR
    -- Users with view/edit access can view orders
    EXISTS (
        SELECT 1 FROM collection_access ca
        WHERE ca.collection_id = c.id
        AND ca.user_id = auth.uid()
        AND ca.access_type IN ('view', 'edit')
    )
)
GROUP BY o.id;

-- Grant permissions
GRANT SELECT ON merchant_orders TO authenticated;

COMMIT; 