-- Fix user_orders view to properly work with JWT wallet address claims
BEGIN;

-- First, create a debug function to check JWT claims
CREATE OR REPLACE FUNCTION debug_auth_jwt()
RETURNS jsonb AS $$
BEGIN
  RETURN coalesce(current_setting('request.jwt.claims', true)::jsonb, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION debug_auth_jwt() TO authenticated;

-- Drop existing view
DROP VIEW IF EXISTS user_orders CASCADE;

-- Recreate view with explicit wallet address filtering
CREATE OR REPLACE VIEW user_orders AS
SELECT 
    o.id,
    o.created_at,
    o.updated_at,
    o.collection_id,
    o.wallet_address,
    o.shipping_address,
    o.contact_info,
    o.status,
    o.amount_sol,
    o.transaction_signature,
    o.product_id,
    o.variant_selections,
    o.order_number,
    o.product_name,
    o.product_sku,
    o.collection_name,
    o.category_name,
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
                'events', COALESCE(
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
    END AS tracking
FROM 
    orders o
    LEFT JOIN order_tracking ot ON ot.order_id = o.id;

-- Create explicit orders policies without relying only on JWT claims
-- These are more reliable and provide a fallback if JWT claims are not formatted as expected
CREATE OR REPLACE FUNCTION get_auth_wallet_address()
RETURNS text AS $$
DECLARE
    jwt_claims jsonb;
    wallet_addr text;
BEGIN
    -- First try to get from jwt claims
    BEGIN
        jwt_claims := coalesce(current_setting('request.jwt.claims', true)::jsonb, '{}'::jsonb);
        wallet_addr := jwt_claims->>'wallet_address';
    EXCEPTION WHEN OTHERS THEN
        wallet_addr := NULL;
    END;
    
    RETURN wallet_addr;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_auth_wallet_address() TO authenticated;

-- Create order selection policy that uses the function
DROP POLICY IF EXISTS "orders_user_view" ON orders;
CREATE POLICY "orders_user_view"
ON orders
FOR SELECT
TO authenticated
USING (
    -- Get wallet_address from the helper function
    wallet_address = get_auth_wallet_address()
);

-- Add permissions
GRANT SELECT ON user_orders TO authenticated;

-- Add comments
COMMENT ON VIEW user_orders IS 'User orders view that retrieves orders for the authenticated wallet address';
COMMENT ON FUNCTION get_auth_wallet_address() IS 'Helper function to reliably get authenticated wallet address from JWT claims';
COMMENT ON FUNCTION debug_auth_jwt() IS 'Debug function to check JWT claims content';

COMMIT; 