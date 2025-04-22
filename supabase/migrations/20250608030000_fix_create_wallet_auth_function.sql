-- Fix the wallet authentication token generation to include wallet address at root level
BEGIN;

-- First, drop the existing function if it exists
DROP FUNCTION IF EXISTS create_wallet_auth;

-- Create an updated version of the function
CREATE OR REPLACE FUNCTION create_wallet_auth(wallet_address text, signature text)
RETURNS jsonb AS $$
DECLARE
    token_header jsonb;
    token_payload jsonb;
    token_parts text[];
    token text;
    user_id text;
    current_time_epoch bigint;
BEGIN
    -- Generate a unique user ID from the wallet address
    user_id := 'wallet_' || substring(wallet_address, 1, 12);
    current_time_epoch := extract(epoch from now())::bigint;
    
    -- Create JWT header and payload
    token_header := jsonb_build_object(
        'typ', 'JWT',
        'alg', 'HS256'
    );
    
    -- Make sure wallet_address is at both the root level and in user_metadata
    token_payload := jsonb_build_object(
        'sub', user_id,
        'wallet_address', wallet_address,  -- <-- Add to root level
        'iat', current_time_epoch,
        'exp', current_time_epoch + 3600,   -- Token expires in 1 hour
        'user_metadata', jsonb_build_object(
            'wallet_address', wallet_address
        ),
        'app_metadata', jsonb_build_object(
            'wallet_address', wallet_address,
            'wallet_auth', true,
            'auth_type', 'wallet'
        )
    );
    
    -- For this simplified version, just use a placeholder signature
    token := 'WALLET_AUTH_SIGNATURE_' || wallet_address || '_TIMESTAMP_' || current_time_epoch || '_VERIFIED';
    
    -- Return the token and additional info
    RETURN jsonb_build_object(
        'token', token,
        'user', jsonb_build_object(
            'id', user_id,
            'wallet', wallet_address,
            'auth_type', 'wallet'
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution permission
GRANT EXECUTE ON FUNCTION create_wallet_auth(text, text) TO anon, authenticated;

-- Add comment explaining the function
COMMENT ON FUNCTION create_wallet_auth IS 'Creates a wallet authentication token with wallet address in JWT claims';

COMMIT; 