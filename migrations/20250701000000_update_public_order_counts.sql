-- Start transaction
BEGIN;

-- Drop and recreate the public_order_counts view
CREATE OR REPLACE VIEW public_order_counts AS
SELECT 
    p.id as product_id,
    p.collection_id,
    COUNT(o.id) as total_orders
FROM products p
LEFT JOIN orders o ON o.product_id = p.id
WHERE 
    -- Only include orders with status confirmed, shipped, or delivered
    (o.status::text IN ('confirmed', 'shipped', 'delivered'))
    -- Keep the existing condition for visible collections
    AND EXISTS (
        SELECT 1 FROM collections c
        WHERE c.id = p.collection_id
        AND c.visible = true
    )
GROUP BY p.id, p.collection_id;

-- Create a function to get detailed order counts for reporting
CREATE OR REPLACE FUNCTION get_order_counts_by_status(p_product_id uuid)
RETURNS jsonb
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
BEGIN
    SELECT jsonb_build_object(
        'total', COUNT(*),
        'confirmed', COUNT(*) FILTER (WHERE status::text = 'confirmed'),
        'shipped', COUNT(*) FILTER (WHERE status::text = 'shipped'),
        'delivered', COUNT(*) FILTER (WHERE status::text = 'delivered'),
        'draft', COUNT(*) FILTER (WHERE status::text = 'draft'),
        'pending_payment', COUNT(*) FILTER (WHERE status::text = 'pending_payment'),
        'cancelled', COUNT(*) FILTER (WHERE status::text = 'cancelled'),
        'bonding_curve_count', COUNT(*) FILTER (WHERE status::text IN ('confirmed', 'shipped', 'delivered'))
    ) INTO result
    FROM orders
    WHERE product_id = p_product_id;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to refresh order counts when order status changes
CREATE OR REPLACE FUNCTION refresh_order_counts()
RETURNS TRIGGER AS $$
BEGIN
    -- Notify the realtime system about the change in public_order_counts for this product
    -- This allows clients subscribed to order counts to get real-time updates
    IF (OLD.status IS DISTINCT FROM NEW.status) AND 
       ((OLD.status::text IN ('confirmed', 'shipped', 'delivered')) OR 
        (NEW.status::text IN ('confirmed', 'shipped', 'delivered'))) THEN
        
        -- Use pg_notify to trigger a realtime event
        PERFORM pg_notify(
            'public_order_counts_changes',
            json_build_object(
                'product_id', NEW.product_id,
                'old_status', OLD.status,
                'new_status', NEW.status
            )::text
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger for order status changes
DROP TRIGGER IF EXISTS order_status_change_notify ON orders;
CREATE TRIGGER order_status_change_notify
AFTER UPDATE OF status ON orders
FOR EACH ROW
EXECUTE FUNCTION refresh_order_counts();

-- Grant appropriate permissions
GRANT EXECUTE ON FUNCTION get_order_counts_by_status(uuid) TO authenticated;

-- Add documentation
COMMENT ON VIEW public_order_counts IS 'Public view of order counts per product, only counting confirmed/shipped/delivered orders in visible collections';
COMMENT ON FUNCTION get_order_counts_by_status(uuid) IS 'Returns detailed order counts by status for a specific product';
COMMENT ON FUNCTION refresh_order_counts() IS 'Trigger function to notify subscribers when order status changes affect order counts';

COMMIT; 