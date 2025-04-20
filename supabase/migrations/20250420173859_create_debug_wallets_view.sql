-- Create a diagnostic view to debug wallet access issues
BEGIN;

-- Create a secure function to get JWT claims
CREATE OR REPLACE FUNCTION get_jwt_claims()
RETURNS jsonb AS $$
BEGIN
  RETURN coalesce(current_setting('request.jwt.claims', true)::jsonb, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a secure function to get wallet address
CREATE OR REPLACE FUNCTION get_jwt_wallet_address()
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

-- Create a diagnostic view for wallet address debug
CREATE OR REPLACE VIEW debug_wallet_auth AS
SELECT 
    get_jwt_claims() AS jwt_claims,
    get_jwt_wallet_address() AS extracted_wallet_address,
    auth.uid() AS auth_uid,
    (SELECT COUNT(*) FROM orders WHERE wallet_address = get_jwt_wallet_address()) AS direct_orders_count,
    (SELECT COUNT(*) FROM user_orders) AS view_orders_count,
    (SELECT ARRAY_AGG(DISTINCT wallet_address) FROM orders WHERE auth.jwt()->'wallet_address' IS NOT NULL) AS all_wallets_with_orders,
    NOW() AS timestamp;

-- Grant access permissions
GRANT EXECUTE ON FUNCTION get_jwt_claims() TO authenticated;
GRANT EXECUTE ON FUNCTION get_jwt_wallet_address() TO authenticated;
GRANT SELECT ON debug_wallet_auth TO authenticated;

COMMIT;
