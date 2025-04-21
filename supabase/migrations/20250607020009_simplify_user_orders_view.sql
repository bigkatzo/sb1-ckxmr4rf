-- Simplify user_orders view without any reference to wallets table
BEGIN;

-- Create a simple user_orders view with just direct JWT claim extraction
CREATE OR REPLACE VIEW user_orders AS
SELECT 
    o.id,
    o.order_number,
    o.status,
    o.created_at,
    o.updated_at,
    o.product_id,
    o.collection_id,
    o.wallet_address,
    o.transaction_signature,
    o.shipping_address,
    o.contact_info,
    o.amount_sol,
    p.name as product_name,
    p.sku as product_sku,
    COALESCE(
        cat.name,
        (o.product_snapshot->>'category_name')::text
    ) as category_name,
    c.name as collection_name,
    o.variant_selections,
    o.product_snapshot,
    o.collection_snapshot,
    o.payment_metadata,
    -- Include tracking information as a JSON object
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
                'updated_at', ot.updated_at,
                'tracking_events', COALESCE(
                    (
                        SELECT jsonb_agg(
                            jsonb_build_object(
                                'id', te.id,
                                'status', te.status,
                                'details', te.details,
                                'location', te.location,
                                'timestamp', te.timestamp,
                                'created_at', te.created_at
                            )
                            ORDER BY te.timestamp DESC
                        )
                        FROM tracking_events te
                        WHERE te.tracking_id = ot.id
                    ),
                    '[]'::jsonb
                )
            )
        ELSE NULL
    END AS tracking,
    CASE
        WHEN o.status = 'delivered' THEN true
        WHEN o.status = 'shipped' AND ot.id IS NOT NULL THEN true
        ELSE false
    END as is_trackable
FROM orders o
JOIN products p ON p.id = o.product_id
JOIN collections c ON c.id = o.collection_id
LEFT JOIN categories cat ON cat.id = p.category_id
LEFT JOIN order_tracking ot ON ot.order_id = o.id
WHERE 
    -- Extract wallet address directly from the JWT claims
    o.wallet_address = COALESCE(
        -- Try to get from JWT claim.user_metadata.wallet_address
        nullif(current_setting('request.jwt.claim.user_metadata.wallet_address', true), ''),
        -- Alternative path
        nullif(current_setting('request.jwt.claim.app_metadata.wallet_address', true), ''),
        -- Direct path
        nullif(current_setting('request.jwt.claim.wallet_address', true), '')
    );

-- Create a debug function for wallet access
CREATE OR REPLACE FUNCTION debug_jwt_wallet_info()
RETURNS jsonb AS $$
DECLARE
   wallet_from_user_metadata text;
   wallet_from_app_metadata text;
   wallet_from_root text;
BEGIN
   -- Try all three potential paths
   BEGIN
      wallet_from_user_metadata := nullif(current_setting('request.jwt.claim.user_metadata.wallet_address', true), '');
   EXCEPTION WHEN OTHERS THEN
      wallet_from_user_metadata := NULL;
   END;
   
   BEGIN
      wallet_from_app_metadata := nullif(current_setting('request.jwt.claim.app_metadata.wallet_address', true), '');
   EXCEPTION WHEN OTHERS THEN
      wallet_from_app_metadata := NULL;
   END;
   
   BEGIN
      wallet_from_root := nullif(current_setting('request.jwt.claim.wallet_address', true), '');
   EXCEPTION WHEN OTHERS THEN
      wallet_from_root := NULL;
   END;
   
   RETURN jsonb_build_object(
      'from_user_metadata', wallet_from_user_metadata,
      'from_app_metadata', wallet_from_app_metadata,
      'from_root', wallet_from_root,
      'effective_wallet', COALESCE(wallet_from_user_metadata, wallet_from_app_metadata, wallet_from_root),
      'auth_uid', auth.uid(),
      'auth_role', auth.role()
   );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION debug_jwt_wallet_info TO authenticated;
GRANT SELECT ON user_orders TO authenticated;

COMMIT; 