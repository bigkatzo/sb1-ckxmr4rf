-- Start transaction
BEGIN;

-- Drop existing function
DROP FUNCTION IF EXISTS apply_coupon_to_order(UUID, TEXT, TEXT);

-- Update apply_coupon_to_order function with eligibility checks
CREATE OR REPLACE FUNCTION apply_coupon_to_order(
    p_order_id UUID,
    p_coupon_code TEXT,
    p_wallet_address TEXT
)
RETURNS UUID AS $$
DECLARE
    v_coupon_id UUID;
    v_product_collection_id UUID;
    v_order_amount NUMERIC;
    v_discount_amount NUMERIC;
    v_order_coupon_id UUID;
    v_eligibility_rules JSONB;
    v_is_eligible BOOLEAN;
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
    SELECT id, eligibility_rules INTO v_coupon_id, v_eligibility_rules
    FROM coupons
    WHERE code = p_coupon_code
    AND (collection_id IS NULL OR collection_id = v_product_collection_id)
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_uses IS NULL OR current_uses < max_uses);

    IF v_coupon_id IS NULL THEN
        RAISE EXCEPTION 'Invalid or expired coupon code';
    END IF;

    -- Check eligibility rules if they exist
    IF v_eligibility_rules IS NOT NULL AND v_eligibility_rules->>'groups' IS NOT NULL AND 
       jsonb_array_length(v_eligibility_rules->'groups') > 0 THEN
        -- Check if wallet address is provided when needed
        IF p_wallet_address IS NULL OR p_wallet_address = '' THEN
            RAISE EXCEPTION 'Wallet address required for this coupon';
        END IF;

        -- Verify eligibility using the verify_wallet_eligibility function
        SELECT verify_wallet_eligibility(p_wallet_address, v_eligibility_rules) INTO v_is_eligible;
        
        IF NOT v_is_eligible THEN
            RAISE EXCEPTION 'Wallet does not meet eligibility requirements';
        END IF;
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

-- Create verify_wallet_eligibility function
CREATE OR REPLACE FUNCTION verify_wallet_eligibility(
    p_wallet_address TEXT,
    p_eligibility_rules JSONB
)
RETURNS BOOLEAN AS $$
DECLARE
    v_group JSONB;
    v_rule JSONB;
    v_group_valid BOOLEAN;
    v_rule_valid BOOLEAN;
BEGIN
    -- If no rules, consider eligible
    IF p_eligibility_rules IS NULL OR p_eligibility_rules->>'groups' IS NULL THEN
        RETURN TRUE;
    END IF;

    -- Check each group (OR relationship between groups)
    FOR v_group IN SELECT * FROM jsonb_array_elements(p_eligibility_rules->'groups')
    LOOP
        v_group_valid := TRUE;
        
        -- Check each rule within the group (AND relationship within group)
        FOR v_rule IN SELECT * FROM jsonb_array_elements(v_group->'rules')
        LOOP
            v_rule_valid := FALSE;
            
            -- Token holding check
            IF v_rule->>'type' = 'token_holding' THEN
                -- Call token balance check function (to be implemented)
                -- For now, return true as placeholder
                v_rule_valid := TRUE;
            
            -- NFT holding check
            ELSIF v_rule->>'type' = 'nft_holding' THEN
                -- Call NFT holding check function (to be implemented)
                -- For now, return true as placeholder
                v_rule_valid := TRUE;
            
            -- Whitelist check
            ELSIF v_rule->>'type' = 'whitelist' THEN
                -- Check if wallet is in whitelist
                SELECT EXISTS (
                    SELECT 1 FROM whitelists
                    WHERE wallet_address = p_wallet_address
                    AND whitelist_id = (v_rule->>'whitelist_id')::uuid
                ) INTO v_rule_valid;
            END IF;
            
            -- If any rule in the group fails, the whole group is invalid
            IF NOT v_rule_valid THEN
                v_group_valid := FALSE;
                EXIT;
            END IF;
        END LOOP;
        
        -- If any group is valid, the wallet is eligible
        IF v_group_valid THEN
            RETURN TRUE;
        END IF;
    END LOOP;
    
    -- If no group was valid, the wallet is not eligible
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION apply_coupon_to_order TO public;
GRANT EXECUTE ON FUNCTION verify_wallet_eligibility TO public;

COMMIT; 