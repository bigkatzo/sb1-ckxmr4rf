-- Verify the user_orders view security
BEGIN;

-- Create a diagnostic function to verify user_orders view filtering
CREATE OR REPLACE FUNCTION verify_user_orders_security()
RETURNS TABLE (
    current_wallet text,
    jwt_wallet_match boolean,
    orders_count integer,
    user_orders_count integer,
    filtered_correctly boolean,
    all_wallets_in_orders text[],
    all_wallets_in_user_orders text[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        auth.jwt()->>'wallet_address' as current_wallet,
        -- Check if all user_orders wallet addresses match the JWT wallet address
        (
            SELECT 
                COALESCE(
                    (
                        SELECT bool_and(wallet_address = auth.jwt()->>'wallet_address') 
                        FROM user_orders
                    ), 
                    true
                )
        ) as jwt_wallet_match,
        -- Count of all orders
        (SELECT COUNT(*) FROM orders) as orders_count,
        -- Count of orders in user_orders view
        (SELECT COUNT(*) FROM user_orders) as user_orders_count,
        -- Check if user_orders count matches direct query with wallet filter
        (
            SELECT COUNT(*) FROM user_orders
        ) = (
            SELECT COUNT(*) 
            FROM orders 
            WHERE check_wallet_access(wallet_address)
        ) as filtered_correctly,
        -- All distinct wallet addresses in orders
        ARRAY(SELECT DISTINCT wallet_address FROM orders ORDER BY wallet_address) as all_wallets_in_orders,
        -- All distinct wallet addresses in user_orders (should only contain current wallet)
        ARRAY(SELECT DISTINCT wallet_address FROM user_orders ORDER BY wallet_address) as all_wallets_in_user_orders;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION verify_user_orders_security TO authenticated;

-- Create a view to check security more easily from the frontend
CREATE OR REPLACE VIEW user_orders_security_check AS
SELECT * FROM verify_user_orders_security();

GRANT SELECT ON user_orders_security_check TO authenticated;

COMMIT; 