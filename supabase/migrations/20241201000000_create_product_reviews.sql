-- ==========================================
-- PRODUCT REVIEW SYSTEM - CORE TABLES
-- ==========================================

BEGIN;

-- Create product_reviews table with all required fields
CREATE TABLE IF NOT EXISTS product_reviews (
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

CREATE POLICY "wallet_owners_can_manage_reviews"
    ON product_reviews
    FOR ALL
    USING (
        -- Use the existing public.current_user_wallet_address function
        wallet_address = public.current_user_wallet_address()
    )
    WITH CHECK (
        -- Same check for write operations
        wallet_address = public.current_user_wallet_address()
    );

-- Create function to get product rating stats (consistent naming with second migration)
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

-- Grant access to the stats function
GRANT EXECUTE ON FUNCTION get_product_review_stats(UUID) TO authenticated, anon;

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

-- Grant permissions
GRANT SELECT ON product_reviews TO anon;
GRANT ALL ON product_reviews TO authenticated;

COMMIT; 