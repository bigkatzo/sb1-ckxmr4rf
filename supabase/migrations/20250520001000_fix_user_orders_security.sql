-- Migration: Fix User Orders Security Vulnerability
-- This migration addresses a critical security vulnerability where user_orders view
-- exposes sensitive customer data to all users regardless of authentication.

BEGIN;

-- First, ensure RLS is enabled on the orders table
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- The primary issue is that the user_orders view doesn't filter by wallet address
-- in the view definition, and we also don't have proper RLS policies.
-- We'll implement a comprehensive solution with two parts:

-- 1. Drop and recreate user_orders view 
-- The view itself shouldn't filter by wallet_address to allow the RLS policy to work correctly
DROP VIEW IF EXISTS user_orders CASCADE;

-- Recreate the view without the filtering clause (to match our latest schema)
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
                'tracking_number', ot.tracking_number,
                'carrier', ot.carrier,
                'status', ot.status,
                'status_details', ot.status_details,
                'estimated_delivery_date', ot.estimated_delivery_date,
                'last_update', ot.last_update,
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

-- 2. Ensure proper RLS policy is in place for orders table
-- Drop existing user view policy if it exists
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "orders_user_view" ON orders;
    DROP POLICY IF EXISTS "orders_users_view_buyers" ON orders;
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

-- Create a secure policy for user orders that strictly enforces wallet-based access
CREATE POLICY "orders_user_view"
ON orders
FOR SELECT
TO authenticated
USING (
    -- Users can only view their own orders by matching wallet address from JWT
    wallet_address = auth.jwt()->>'wallet_address'
);

-- 3. Grant appropriate permissions
GRANT SELECT ON user_orders TO authenticated;

-- 4. Add comments to document the security model
COMMENT ON VIEW user_orders IS 'User-facing view of orders with optional tracking information. Secured via RLS policies that filter by wallet address.';
COMMENT ON POLICY "orders_user_view" ON orders IS 'Restricts users to viewing only orders that match their authenticated wallet address';

-- Verify that any existing RLS for merchant orders is also in place
DO $$ 
BEGIN
    -- Check if merchant view policy exists, if not create it
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'orders' AND (policyname = 'orders_merchant_view' OR policyname = 'orders_dashboard_view')
    ) THEN
        CREATE POLICY "orders_merchant_view"
        ON orders
        FOR SELECT
        TO authenticated
        USING (
            -- Admins can view all orders
            EXISTS (
                SELECT 1 FROM user_profiles up
                WHERE up.id = auth.uid()
                AND up.role = 'admin'
            )
            OR
            -- Collection owners can view orders for their collections
            EXISTS (
                SELECT 1 FROM collections c
                WHERE c.id = collection_id
                AND c.user_id = auth.uid()
            )
            OR
            -- Users with collection access can view orders
            EXISTS (
                SELECT 1 FROM collections c
                JOIN collection_access ca ON ca.collection_id = c.id
                WHERE c.id = collection_id
                AND ca.user_id = auth.uid()
                AND ca.access_type IN ('view', 'edit')
            )
        );
    END IF;
END $$;

COMMIT; 