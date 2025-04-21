-- Fix orders view to ensure correct joining and filtering
BEGIN;

-- First create a diagnostic function to identify issues
CREATE OR REPLACE FUNCTION debug_orders_for_wallet(target_wallet text)
RETURNS TABLE (
    id uuid,
    order_number text,
    wallet_address text,
    status text,
    jwt_extracted_wallet text,
    jwt_match boolean,
    access_check boolean,
    orders_count bigint
) AS $$
BEGIN
    -- Get the current wallet from JWT
    DECLARE
        current_wallet text := extract_wallet_from_jwt();
    BEGIN
        RETURN QUERY
        WITH wallet_orders AS (
            SELECT 
                o.id,
                o.order_number,
                o.wallet_address,
                o.status
            FROM orders o
            WHERE o.wallet_address = target_wallet
        )
        SELECT 
            wo.id,
            wo.order_number,
            wo.wallet_address,
            wo.status,
            current_wallet,
            wo.wallet_address = current_wallet,
            check_wallet_access(wo.wallet_address),
            (SELECT COUNT(*) FROM orders WHERE wallet_address = target_wallet)
        FROM wallet_orders wo;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the user_orders view to fix potential join issues
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
    o.product_name, -- Use stored values from orders table
    o.product_sku,  -- Use stored values from orders table
    COALESCE(c.name, o.collection_name) as collection_name,
    CASE 
        WHEN o.product_snapshot->>'category_name' IS NOT NULL 
        THEN o.product_snapshot->>'category_name'
        ELSE NULL
    END as category_name,
    -- Include tracking as a JSON field
    CASE 
        WHEN ot.id IS NOT NULL THEN 
            to_jsonb(ot.*)
        ELSE NULL
    END AS tracking,
    CASE 
        WHEN o.status = 'delivered' THEN true
        WHEN o.status = 'shipped' AND ot.id IS NOT NULL THEN true
        ELSE false
    END as is_trackable
FROM 
    orders o
    -- Use LEFT JOINs to ensure we don't lose orders even if related data is missing
    LEFT JOIN collections c ON c.id = o.collection_id
    LEFT JOIN order_tracking ot ON ot.order_id = o.id
WHERE 
    -- Simplify the wallet access condition to ensure reliability
    (
        o.wallet_address = extract_wallet_from_jwt()
        OR check_wallet_access(o.wallet_address)
    );

-- Improve row-level security on orders table
DROP POLICY IF EXISTS "orders_user_view" ON orders;

CREATE POLICY "orders_user_view" 
ON orders
FOR SELECT
TO authenticated
USING (
    wallet_address = extract_wallet_from_jwt()
    OR check_wallet_access(wallet_address)
);

-- Grant permissions
GRANT SELECT ON user_orders TO authenticated;
GRANT EXECUTE ON FUNCTION debug_orders_for_wallet(text) TO authenticated;

-- Add comments
COMMENT ON VIEW user_orders IS 'Enhanced user orders view with simplified joins to prevent data loss';
COMMENT ON FUNCTION debug_orders_for_wallet(text) IS 'Diagnostic function to identify orders access issues for a specified wallet';

COMMIT; 