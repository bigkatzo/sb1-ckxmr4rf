-- Add debug view to help identify JWT wallet extraction issues
BEGIN;

-- Create a debugging view to show all paths where wallet is being checked
CREATE OR REPLACE VIEW debug_user_orders AS
SELECT 
    o.id,
    o.wallet_address,
    -- Test all possible JWT paths
    current_setting('request.jwt.claim.wallet_address', true) AS jwt_root_wallet,
    current_setting('request.jwt.claim.user_metadata.wallet_address', true) AS jwt_user_metadata_wallet,
    current_setting('request.jwt.claim.app_metadata.wallet_address', true) AS jwt_app_metadata_wallet,
    -- Extract the full JWT claims for analysis
    (current_setting('request.jwt.claims', true))::text AS raw_jwt,
    -- Test the check_wallet_access function
    check_wallet_access(o.wallet_address) AS wallet_access_check,
    -- Compare wallet address directly to debug
    o.wallet_address = current_setting('request.jwt.claim.user_metadata.wallet_address', true) AS direct_user_meta_match,
    o.wallet_address = current_setting('request.jwt.claim.wallet_address', true) AS direct_root_match,
    o.wallet_address = current_setting('request.jwt.claim.app_metadata.wallet_address', true) AS direct_app_meta_match
FROM 
    orders o;

-- Create a modified user_orders view that uses multiple JWT paths
DROP VIEW IF EXISTS user_orders CASCADE;

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
    o.variant_selections,
    o.product_snapshot,
    o.collection_snapshot,
    o.payment_metadata,
    COALESCE(p.name, o.product_name) as product_name,
    COALESCE(p.sku, o.product_sku) as product_sku,
    COALESCE(c.name, o.collection_name) as collection_name,
    t as tracking,
    CASE 
        WHEN o.status = 'delivered' THEN true
        WHEN o.status = 'shipped' AND t IS NOT NULL THEN true
        ELSE false
    END as is_trackable
FROM 
    orders o
    LEFT JOIN products p ON p.id = o.product_id
    LEFT JOIN collections c ON c.id = o.collection_id
    LEFT JOIN LATERAL (
        SELECT to_jsonb(ot.*) as t
        FROM order_tracking ot
        WHERE ot.order_id = o.id
        LIMIT 1
    ) t1 ON true
WHERE 
    -- Try all possible wallet extraction paths
    o.wallet_address = COALESCE(
        nullif(current_setting('request.jwt.claim.wallet_address', true), ''),
        nullif(current_setting('request.jwt.claim.user_metadata.wallet_address', true), ''),
        nullif(current_setting('request.jwt.claim.app_metadata.wallet_address', true), '')
    )
    -- If all direct comparisons fail, fall back to the check_wallet_access function
    OR check_wallet_access(o.wallet_address);

-- Grant permissions to access the views
GRANT SELECT ON debug_user_orders TO authenticated;
GRANT SELECT ON user_orders TO authenticated;

-- Add comments to the views
COMMENT ON VIEW debug_user_orders IS 'Debug view to help troubleshoot JWT wallet extraction issues';
COMMENT ON VIEW user_orders IS 'Enhanced user orders view with multiple JWT path checks for wallet address';

COMMIT; 