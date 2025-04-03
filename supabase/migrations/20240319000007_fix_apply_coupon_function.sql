-- Start transaction
BEGIN;

-- Update the apply_coupon_to_order function to properly get collection_id
CREATE OR REPLACE FUNCTION apply_coupon_to_order(
    p_order_id UUID,
    p_coupon_code TEXT
)
RETURNS UUID AS $$
DECLARE
    v_coupon_id UUID;
    v_product_collection_id UUID;
    v_order_amount NUMERIC;
    v_discount_amount NUMERIC;
    v_order_coupon_id UUID;
BEGIN
    -- Get order details and collection
    SELECT p.collection_id, o.amount_sol
    INTO v_product_collection_id, v_order_amount
    FROM orders o
    JOIN products p ON p.id = o.product_id
    WHERE o.id = p_order_id;

    IF v_product_collection_id IS NULL THEN
        RAISE EXCEPTION 'Order not found or invalid';
    END IF;

    -- Get and validate coupon
    SELECT id INTO v_coupon_id
    FROM coupons
    WHERE code = p_coupon_code
    AND collection_id = v_product_collection_id
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
GRANT EXECUTE ON FUNCTION apply_coupon_to_order TO public;

COMMIT; 