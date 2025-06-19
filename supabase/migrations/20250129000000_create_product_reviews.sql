-- ==========================================
-- PRODUCT REVIEW SYSTEM - COMPLETE MIGRATION
-- ==========================================

BEGIN;

-- Drop existing table if it exists to ensure clean creation
DROP TABLE IF EXISTS product_reviews;

-- Create product_reviews table with all required fields
CREATE TABLE product_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    wallet_address TEXT NOT NULL,
    product_rating INTEGER NOT NULL CHECK (product_rating >= 1 AND product_rating <= 5),
    review_text TEXT CHECK (review_text IS NULL OR length(review_text) BETWEEN 10 AND 1000),
    is_verified_purchase BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(product_id, wallet_address)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_wallet_address ON product_reviews(wallet_address);
CREATE INDEX IF NOT EXISTS idx_product_reviews_order_id ON product_reviews(order_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_rating ON product_reviews(product_rating);
CREATE INDEX IF NOT EXISTS idx_product_reviews_verified ON product_reviews(is_verified_purchase);

-- Enable RLS
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "anyone_can_read_reviews"
    ON product_reviews FOR SELECT
    USING (true);

CREATE POLICY "authenticated_users_can_manage_reviews"
    ON product_reviews
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_product_review_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_product_review_updated_at
    BEFORE UPDATE ON product_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_product_review_updated_at();

-- Function: Get product rating stats
CREATE OR REPLACE FUNCTION get_product_review_stats(p_product_id UUID)
RETURNS jsonb AS $$
DECLARE
    result jsonb;
    total_count integer;
    avg_rating numeric;
BEGIN
    -- Get aggregate data
    SELECT 
        COUNT(*)::integer,
        COALESCE(ROUND(AVG(product_rating::numeric), 1), 0)
    INTO total_count, avg_rating
    FROM product_reviews
    WHERE product_id = p_product_id;
    
    -- Build comprehensive result
    SELECT jsonb_build_object(
        'total_reviews', total_count,
        'average_rating', avg_rating,
        'rating_distribution', jsonb_build_object(
            '5', COUNT(*) FILTER (WHERE product_rating = 5),
            '4', COUNT(*) FILTER (WHERE product_rating = 4),
            '3', COUNT(*) FILTER (WHERE product_rating = 3),
            '2', COUNT(*) FILTER (WHERE product_rating = 2),
            '1', COUNT(*) FILTER (WHERE product_rating = 1)
        ),
        'recent_reviews', (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'rating', product_rating,
                    'text', review_text,
                    'created_at', created_at
                ) ORDER BY created_at DESC
            )
            FROM (
                SELECT product_rating, review_text, created_at
                FROM product_reviews
                WHERE product_id = p_product_id
                ORDER BY created_at DESC
                LIMIT 3
            ) recent
        )
    ) INTO result
    FROM product_reviews
    WHERE product_id = p_product_id;
    
    -- Return default if no reviews
    RETURN COALESCE(result, jsonb_build_object(
        'total_reviews', 0,
        'average_rating', 0,
        'rating_distribution', jsonb_build_object('5', 0, '4', 0, '3', 0, '2', 0, '1', 0),
        'recent_reviews', '[]'::jsonb
    ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check if user can review a product from an order
CREATE OR REPLACE FUNCTION can_user_review_product(p_order_id uuid, p_product_id uuid)
RETURNS jsonb AS $$
DECLARE
    order_record record;
    current_wallet text;
BEGIN
    -- Get current user's wallet using the auth schema function
    current_wallet := auth.get_header_values()->>'wallet_address';
    
    IF current_wallet IS NULL THEN
        RETURN jsonb_build_object(
            'can_review', false,
            'reason', 'Please connect your wallet'
        );
    END IF;

    -- Check if order exists and belongs to user
    SELECT * INTO order_record
    FROM orders
    WHERE id = p_order_id
    AND product_id = p_product_id
    AND wallet_address = current_wallet;

    IF order_record IS NULL THEN
        RETURN jsonb_build_object(
            'can_review', false,
            'reason', 'Order not found or does not belong to you'
        );
    END IF;

    -- Check order status - allow reviews for delivered orders
    IF order_record.status NOT IN ('delivered', 'confirmed', 'shipped') THEN
        RETURN jsonb_build_object(
            'can_review', false,
            'reason', 'Order must be confirmed, shipped or delivered before reviewing',
            'order_status', order_record.status
        );
    END IF;

    -- Check if review already exists
    IF EXISTS (
        SELECT 1 FROM product_reviews
        WHERE order_id = p_order_id
        AND product_id = p_product_id
        AND wallet_address = current_wallet
    ) THEN
        RETURN jsonb_build_object(
            'can_review', false,
            'reason', 'You have already reviewed this product'
        );
    END IF;

    -- All checks passed
    RETURN jsonb_build_object(
        'can_review', true,
        'reason', 'You can review this product',
        'order_status', order_record.status
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Submit a product review
CREATE OR REPLACE FUNCTION submit_product_review(
    p_order_id uuid,
    p_product_id uuid,
    p_product_rating integer,
    p_review_text text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
    current_wallet text;
    can_review_result jsonb;
    review_id uuid;
    order_status text;
BEGIN
    -- Get current wallet using the auth schema function
    current_wallet := auth.get_header_values()->>'wallet_address';
    
    IF current_wallet IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Please connect your wallet'
        );
    END IF;
    
    -- Check if user can review
    can_review_result := can_user_review_product(p_order_id, p_product_id);
    
    IF NOT (can_review_result->>'can_review')::boolean THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', can_review_result->>'reason'
        );
    END IF;
    
    -- Validate rating
    IF p_product_rating < 1 OR p_product_rating > 5 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Product rating must be between 1 and 5'
        );
    END IF;
    
    -- Validate review text if provided
    IF p_review_text IS NOT NULL THEN
        p_review_text := trim(p_review_text);
        IF length(p_review_text) > 0 AND (length(p_review_text) < 10 OR length(p_review_text) > 1000) THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Review text must be between 10 and 1000 characters if provided'
            );
        END IF;
        -- Set to NULL if empty after trimming
        IF length(p_review_text) = 0 THEN
            p_review_text := NULL;
        END IF;
    END IF;
    
    -- Get order status for verification
    SELECT status INTO order_status
    FROM orders
    WHERE id = p_order_id;
    
    -- Insert review
    INSERT INTO product_reviews (
        product_id,
        order_id,
        wallet_address,
        product_rating,
        review_text,
        is_verified_purchase
    ) VALUES (
        p_product_id,
        p_order_id,
        current_wallet,
        p_product_rating,
        p_review_text,
        order_status IN ('delivered', 'confirmed', 'shipped')
    ) RETURNING id INTO review_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'review_id', review_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get formatted reviews with pagination
CREATE OR REPLACE FUNCTION get_product_reviews_formatted(
    p_product_id uuid,
    p_limit integer DEFAULT 10,
    p_offset integer DEFAULT 0,
    p_order_by text DEFAULT 'created_at DESC'
)
RETURNS TABLE (
    id uuid,
    product_rating integer,
    review_text text,
    wallet_address text,
    formatted_wallet text,
    is_verified_purchase boolean,
    created_at timestamptz,
    updated_at timestamptz,
    days_ago integer
) AS $$
BEGIN
    RETURN QUERY EXECUTE format('
        SELECT 
            pr.id,
            pr.product_rating,
            pr.review_text,
            pr.wallet_address,
            CASE 
                WHEN length(pr.wallet_address) > 8 THEN 
                    substring(pr.wallet_address, 1, 4) || ''...'' || substring(pr.wallet_address, -4)
                ELSE pr.wallet_address
            END as formatted_wallet,
            pr.is_verified_purchase,
            pr.created_at,
            pr.updated_at,
            EXTRACT(days FROM (now() - pr.created_at))::integer as days_ago
        FROM product_reviews pr
        WHERE pr.product_id = $1
        ORDER BY %s
        LIMIT $2 OFFSET $3
    ', p_order_by)
    USING p_product_id, p_limit, p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Format wallet address for display
CREATE OR REPLACE FUNCTION format_wallet_address(wallet text)
RETURNS text AS $$
BEGIN
    IF wallet IS NULL OR length(wallet) < 8 THEN
        RETURN wallet;
    END IF;
    RETURN substring(wallet, 1, 4) || '...' || substring(wallet, -4);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Grant permissions
GRANT SELECT ON product_reviews TO anon;
GRANT ALL ON product_reviews TO authenticated;

-- Grant function permissions
GRANT EXECUTE ON FUNCTION get_product_review_stats(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION can_user_review_product(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION submit_product_review(uuid, uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_product_reviews_formatted(uuid, integer, integer, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION format_wallet_address(text) TO authenticated, anon;

COMMIT; 