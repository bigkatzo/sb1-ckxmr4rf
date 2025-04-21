-- Simplify RLS approach with direct orders table access
BEGIN;

-- Drop existing policy
DROP POLICY IF EXISTS "orders_user_view" ON orders;

-- Create a simple direct RLS policy that should work reliably
CREATE POLICY "orders_user_view"
ON orders
FOR SELECT
TO authenticated
USING (
    -- WALLET AUTH: Users can access orders matching their wallet address
    -- This is a completely separate auth mechanism from the merchant system
    wallet_address = ANY(ARRAY[
      current_setting('request.jwt.claim.wallet_address', true), 
      current_setting('request.jwt.claim.user_metadata.wallet_address', true), 
      current_setting('request.jwt.claim.app_metadata.wallet_address', true)
    ])
);

-- Create separate policy for merchant system - distinct from wallet auth
CREATE POLICY "orders_merchant_view"
ON orders
FOR SELECT
TO authenticated
USING (
    -- MERCHANT AUTH: Collection owners can view orders from their collections
    EXISTS (
        SELECT 1 FROM collections c
        WHERE c.id = collection_id
        AND c.user_id = auth.uid()
    )
    OR
    -- Merchant users with collection access can view orders
    EXISTS (
        SELECT 1 FROM collections c
        JOIN collection_access ca ON ca.collection_id = c.id
        WHERE c.id = collection_id
        AND ca.user_id = auth.uid()
        AND ca.access_type IN ('view', 'edit')
    )
    OR
    -- Admin users can view all orders
    EXISTS (
        SELECT 1 FROM user_profiles up
        WHERE up.id = auth.uid()
        AND up.role = 'admin'
    )
);

-- Create or replace a debug function with raw output
CREATE OR REPLACE FUNCTION dump_auth_info()
RETURNS jsonb AS $$
BEGIN
    RETURN jsonb_build_object(
        'current_user', current_user,
        'direct_jwt_claim', current_setting('request.jwt.claims', false)::text,
        'auth_uid', auth.uid(),
        'role', auth.role(),
        'jwt_headers', current_setting('request.headers', true),
        'session_id', current_setting('request.jwt.claim.session_id', true),
        'user_id', current_setting('request.jwt.claim.sub', true)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to debug function
GRANT EXECUTE ON FUNCTION dump_auth_info TO authenticated;

COMMENT ON POLICY orders_user_view ON orders IS 'Allows wallet-based authentication to view only orders matching wallet in JWT claims';
COMMENT ON POLICY orders_merchant_view ON orders IS 'Separate policy for merchant system auth (collection owners, admins)';

COMMIT; 