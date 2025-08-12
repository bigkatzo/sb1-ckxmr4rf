-- Update public_order_counts view to use SUM(quantity) instead of COUNT(id)
-- This ensures bonding curve and item counts reflect actual quantities ordered

BEGIN;

CREATE OR REPLACE VIEW public_order_counts AS
SELECT 
    p.id as product_id,
    p.collection_id,
    COALESCE(SUM(o.quantity)::bigint, 0) as total_orders
FROM products p
LEFT JOIN orders o ON o.product_id = p.id
WHERE 
    (o.status::text IN ('confirmed', 'preparing', 'shipped', 'delivered'))
    AND EXISTS (
        SELECT 1 FROM collections c
        WHERE c.id = p.collection_id
        AND c.visible = true
    )
GROUP BY p.id, p.collection_id;

-- Update get_order_counts_by_status to use SUM(quantity) for bonding_curve_count
CREATE OR REPLACE FUNCTION get_order_counts_by_status(p_product_id uuid)
RETURNS jsonb
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
BEGIN
    SELECT jsonb_build_object(
        'total', COALESCE(SUM(quantity)::bigint, 0),
        'confirmed', COALESCE((SELECT SUM(quantity)::bigint FROM orders WHERE product_id = p_product_id AND status::text = 'confirmed'), 0),
        'preparing', COALESCE((SELECT SUM(quantity)::bigint FROM orders WHERE product_id = p_product_id AND status::text = 'preparing'), 0),
        'shipped', COALESCE((SELECT SUM(quantity)::bigint FROM orders WHERE product_id = p_product_id AND status::text = 'shipped'), 0),
        'delivered', COALESCE((SELECT SUM(quantity)::bigint FROM orders WHERE product_id = p_product_id AND status::text = 'delivered'), 0),
        'draft', COALESCE((SELECT SUM(quantity)::bigint FROM orders WHERE product_id = p_product_id AND status::text = 'draft'), 0),
        'pending_payment', COALESCE((SELECT SUM(quantity)::bigint FROM orders WHERE product_id = p_product_id AND status::text = 'pending_payment'), 0),
        'cancelled', COALESCE((SELECT SUM(quantity)::bigint FROM orders WHERE product_id = p_product_id AND status::text = 'cancelled'), 0),
        'bonding_curve_count', COALESCE((SELECT SUM(quantity)::bigint FROM orders WHERE product_id = p_product_id AND status::text IN ('confirmed', 'preparing', 'shipped', 'delivered')), 0)
    ) INTO result
    FROM orders
    WHERE product_id = p_product_id;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON VIEW public_order_counts IS 'Public view of order counts per product, counting actual quantity for confirmed, preparing, shipped, and delivered orders in visible collections';
COMMENT ON FUNCTION get_order_counts_by_status(uuid) IS 'Returns detailed order counts by status for a specific product, using SUM(quantity) for all counts';

COMMIT;
