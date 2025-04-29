-- Start transaction
BEGIN;

-- Update the public_order_counts view to include 'preparing' status
CREATE OR REPLACE VIEW public_order_counts AS
SELECT 
    p.id as product_id,
    p.collection_id,
    COUNT(o.id) as total_orders
FROM products p
LEFT JOIN orders o ON o.product_id = p.id
WHERE 
    -- Include orders with status confirmed, preparing, shipped, or delivered
    (o.status::text IN ('confirmed', 'preparing', 'shipped', 'delivered'))
    -- Keep the existing condition for visible collections
    AND EXISTS (
        SELECT 1 FROM collections c
        WHERE c.id = p.collection_id
        AND c.visible = true
    )
GROUP BY p.id, p.collection_id;

-- Update the function to get detailed order counts for reporting
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
        'preparing', COUNT(*) FILTER (WHERE status::text = 'preparing'),
        'shipped', COUNT(*) FILTER (WHERE status::text = 'shipped'),
        'delivered', COUNT(*) FILTER (WHERE status::text = 'delivered'),
        'draft', COUNT(*) FILTER (WHERE status::text = 'draft'),
        'pending_payment', COUNT(*) FILTER (WHERE status::text = 'pending_payment'),
        'cancelled', COUNT(*) FILTER (WHERE status::text = 'cancelled'),
        'bonding_curve_count', COUNT(*) FILTER (WHERE status::text IN ('confirmed', 'preparing', 'shipped', 'delivered'))
    ) INTO result
    FROM orders
    WHERE product_id = p_product_id;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Update the trigger function to include 'preparing' status in realtime notifications
CREATE OR REPLACE FUNCTION refresh_order_counts()
RETURNS TRIGGER AS $$
BEGIN
    -- Notify the realtime system about the change in public_order_counts for this product
    -- This allows clients subscribed to order counts to get real-time updates
    IF (OLD.status IS DISTINCT FROM NEW.status) AND 
       ((OLD.status::text IN ('confirmed', 'preparing', 'shipped', 'delivered')) OR 
        (NEW.status::text IN ('confirmed', 'preparing', 'shipped', 'delivered'))) THEN
        
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

-- Recreate the get_best_sellers function to match our updated view
CREATE OR REPLACE FUNCTION public.get_best_sellers(p_limit integer DEFAULT 6, p_sort_by text DEFAULT 'sales')
RETURNS SETOF public_products_with_categories
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.*
  FROM public_products_with_categories p
  LEFT JOIN public_order_counts oc ON p.id = oc.product_id
  WHERE p.collection_sale_ended = false
  ORDER BY 
    CASE 
      WHEN p_sort_by = 'sales' THEN COALESCE(oc.total_orders, 0)
      ELSE p.quantity 
    END DESC
  LIMIT p_limit;
$$;

-- Recreate the get_best_sellers_v2 function to match our updated view
CREATE OR REPLACE FUNCTION public.get_best_sellers_v2(limit_count integer DEFAULT 10, collection_slug text DEFAULT NULL)
RETURNS SETOF public_products_with_categories
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.*
  FROM public_products_with_categories p
  LEFT JOIN public_order_counts oc ON p.id = oc.product_id
  WHERE (collection_slug IS NULL OR p.collection_slug = collection_slug)
    AND p.collection_launch_date <= NOW()
    AND NOT p.collection_sale_ended
  ORDER BY COALESCE(oc.total_orders, 0) DESC, p.collection_launch_date DESC
  LIMIT limit_count;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_best_sellers(integer, text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_best_sellers_v2(integer, text) TO anon;
GRANT EXECUTE ON FUNCTION get_order_counts_by_status(uuid) TO authenticated;

-- Update comments
COMMENT ON VIEW public_order_counts IS 'Public view of order counts per product, counting confirmed, preparing, shipped, and delivered orders in visible collections';
COMMENT ON FUNCTION get_order_counts_by_status(uuid) IS 'Returns detailed order counts by status for a specific product';
COMMENT ON FUNCTION refresh_order_counts() IS 'Trigger function to notify subscribers when order status changes affect order counts';
COMMENT ON FUNCTION public.get_best_sellers(integer, text) IS 'Returns best-selling products from visible collections with active sales, sorted by validated orders (confirmed, preparing, shipped, delivered)';
COMMENT ON FUNCTION public.get_best_sellers_v2(integer, text) IS 'Returns best-selling products for a specific collection, sorted by validated orders (confirmed, preparing, shipped, delivered)';

COMMIT; 