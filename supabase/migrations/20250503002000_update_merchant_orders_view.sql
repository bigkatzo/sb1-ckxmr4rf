-- Migration to update merchant_orders view to handle the new 'preparing' status
BEGIN;

-- Drop and recreate merchant_orders view
DROP VIEW IF EXISTS merchant_orders;

-- Create updated merchant_orders view
CREATE OR REPLACE VIEW merchant_orders AS
SELECT 
    o.id,
    o.order_number,
    o.product_id,
    o.collection_id,
    o.wallet_address,
    o.transaction_signature,
    o.shipping_address,
    o.contact_info,
    o.status,
    o.amount_sol,
    o.created_at,
    o.updated_at,
    p.name as product_name,
    p.sku as product_sku,
    COALESCE(p.images[1], '') as product_image_url,
    c.name as collection_name,
    cat.name as category_name,
    cat.description as category_description,
    cat.type as category_type,
    o.variant_selections,
    p.variants as product_variants,
    p.variant_prices as product_variant_prices,
    o.product_snapshot,
    o.collection_snapshot,
    ot.tracking_data as tracking,
    o.payment_metadata,
    CASE 
        WHEN up.role = 'admin' THEN 'admin'
        WHEN c.user_id = auth.uid() THEN 'owner'
        WHEN ca.access_type IS NOT NULL THEN ca.access_type
        ELSE 'none'
    END as access_type
FROM 
    orders o
LEFT JOIN 
    products p ON p.id = o.product_id
LEFT JOIN 
    collections c ON c.id = o.collection_id
LEFT JOIN 
    categories cat ON cat.id = p.category_id
LEFT JOIN 
    collection_access ca ON ca.collection_id = o.collection_id AND ca.user_id = auth.uid()
LEFT JOIN 
    user_profiles up ON up.id = auth.uid()
LEFT JOIN
    (SELECT order_id, jsonb_build_object(
      'id', id,
      'order_id', order_id,
      'tracking_number', tracking_number,
      'carrier', carrier,
      'status', status,
      'status_details', status_details,
      'estimated_delivery_date', estimated_delivery_date,
      'last_update', last_update,
      'created_at', created_at,
      'updated_at', updated_at
    ) AS tracking_data
    FROM order_tracking) ot ON ot.order_id = o.id
WHERE 
    (
        -- Admin access
        up.role = 'admin'
        OR
        -- Collection owner 
        c.user_id = auth.uid()
        OR
        -- Collection access permission
        ca.access_type IN ('view', 'edit')
    )
ORDER BY 
    -- Sort by status priority: important statuses first
    CASE 
        WHEN o.status = 'confirmed' THEN 1
        WHEN o.status = 'preparing' THEN 2
        WHEN o.status = 'pending_payment' THEN 3
        WHEN o.status = 'shipped' THEN 4
        WHEN o.status = 'delivered' THEN 5
        WHEN o.status = 'cancelled' THEN 6
        WHEN o.status = 'draft' THEN 7
        ELSE 8
    END,
    -- Then sort by date, newest first
    o.created_at DESC;

COMMIT; 