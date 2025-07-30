-- Update merchant_orders view to include custom_data
BEGIN;

-- Drop existing view
DROP VIEW IF EXISTS merchant_orders CASCADE;

-- Recreate merchant_orders view with custom_data
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
    o.payment_metadata,
    -- Add custom_data as a JSON object
    CASE 
        WHEN cd.id IS NOT NULL THEN 
            jsonb_build_object(
                'id', cd.id,
                'customizable_image', cd.customizable_image,
                'customizable_text', cd.customizable_text,
                'created_at', cd.created_at
            )
        ELSE NULL
    END as custom_data,
    -- Add tracking information as a JSON object
    CASE 
        WHEN ot.id IS NOT NULL THEN 
            jsonb_build_object(
                'id', ot.id,
                'order_id', ot.order_id,
                'tracking_number', ot.tracking_number,
                'carrier', ot.carrier,
                'status', ot.status,
                'status_details', ot.status_details,
                'estimated_delivery_date', ot.estimated_delivery_date,
                'last_update', ot.last_update,
                'created_at', ot.created_at,
                'updated_at', ot.updated_at
            )
        ELSE NULL
    END as tracking,
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
    custom_data cd ON cd.order_id = o.id
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
        -- Collection owner access
        c.user_id = auth.uid()
        OR
        -- Collection access granted
        ca.access_type IS NOT NULL
    );

-- Grant permissions on the view
GRANT SELECT ON merchant_orders TO authenticated;

COMMIT; 