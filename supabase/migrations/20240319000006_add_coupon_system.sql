-- Start transaction
BEGIN;

-- Create coupons table if it doesn't exist
CREATE TABLE IF NOT EXISTS coupons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id uuid REFERENCES collections(id) ON DELETE CASCADE,
    code text NOT NULL UNIQUE,
    description text,
    discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value numeric(10,2) NOT NULL CHECK (discount_value > 0),
    min_purchase_amount numeric(10,2),
    max_discount_amount numeric(10,2),
    starts_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz,
    max_uses integer,
    current_uses integer DEFAULT 0,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create order_coupons junction table
CREATE TABLE IF NOT EXISTS order_coupons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
    coupon_id uuid REFERENCES coupons(id) ON DELETE SET NULL,
    discount_amount numeric(10,2) NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_coupons_collection_id ON coupons(collection_id);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_status ON coupons(status);
CREATE INDEX IF NOT EXISTS idx_order_coupons_order_id ON order_coupons(order_id);
CREATE INDEX IF NOT EXISTS idx_order_coupons_coupon_id ON order_coupons(coupon_id);

-- Enable RLS
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_coupons ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for coupons
CREATE POLICY "Merchants can manage their collection's coupons"
    ON coupons FOR ALL
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM collections c
        WHERE c.id = coupons.collection_id
        AND c.user_id = auth.uid()
    ));

CREATE POLICY "Anyone can view active coupons"
    ON coupons FOR SELECT
    TO authenticated
    USING (
        status = 'active'
        AND (expires_at IS NULL OR expires_at > now())
        AND (max_uses IS NULL OR current_uses < max_uses)
    );

-- Create RLS policies for order_coupons
CREATE POLICY "Merchants can view their collection's order coupons"
    ON order_coupons FOR SELECT
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM orders o
        JOIN products p ON p.id = o.product_id
        JOIN collections c ON c.id = p.collection_id
        WHERE o.id = order_coupons.order_id
        AND c.user_id = auth.uid()
    ));

-- Function to validate and apply coupon to order
CREATE OR REPLACE FUNCTION apply_coupon_to_order(
    p_order_id UUID,
    p_coupon_code TEXT
)
RETURNS UUID AS $$
DECLARE
    v_coupon_id UUID;
    v_collection_id UUID;
    v_order_amount NUMERIC;
    v_discount_amount NUMERIC;
    v_order_coupon_id UUID;
BEGIN
    -- Get order details and collection
    SELECT p.collection_id, o.amount_sol
    INTO v_collection_id, v_order_amount
    FROM orders o
    JOIN products p ON p.id = o.product_id
    WHERE o.id = p_order_id;

    IF v_collection_id IS NULL THEN
        RAISE EXCEPTION 'Order not found or invalid';
    END IF;

    -- Get and validate coupon
    SELECT id INTO v_coupon_id
    FROM coupons
    WHERE code = p_coupon_code
    AND collection_id = v_collection_id
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_uses IS NULL OR current_uses < max_uses);

    IF v_coupon_id IS NULL THEN
        RAISE EXCEPTION 'Invalid or expired coupon code';
    END IF;

    -- Calculate discount
    SELECT
        CASE
            WHEN discount_type = 'percentage' THEN
                LEAST(
                    v_order_amount * (discount_value / 100),
                    COALESCE(max_discount_amount, v_order_amount)
                )
            ELSE
                LEAST(discount_value, v_order_amount)
        END
    INTO v_discount_amount
    FROM coupons
    WHERE id = v_coupon_id;

    -- Insert order_coupon record
    INSERT INTO order_coupons (
        order_id,
        coupon_id,
        discount_amount
    ) VALUES (
        p_order_id,
        v_coupon_id,
        v_discount_amount
    )
    RETURNING id INTO v_order_coupon_id;

    -- Update coupon usage
    UPDATE coupons
    SET current_uses = current_uses + 1
    WHERE id = v_coupon_id;

    RETURN v_order_coupon_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SEQUENCE order_coupons_id_seq TO public;
GRANT ALL ON TABLE coupons TO authenticated;
GRANT ALL ON TABLE order_coupons TO authenticated;
GRANT EXECUTE ON FUNCTION apply_coupon_to_order TO public;

COMMIT; 