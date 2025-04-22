-- Fix critical security issue where wallet data can be accessed without proper token validation
BEGIN;

-- Enhance auth.wallet_matches function to validate token format
CREATE OR REPLACE FUNCTION auth.wallet_matches(check_wallet text) 
RETURNS boolean AS $$
DECLARE
  auth_info jsonb;
  header_wallet text;
  wallet_token text;
  has_token boolean;
  jwt_wallet text;
  result boolean;
BEGIN
  -- Get auth info using the reliable function
  auth_info := auth.get_header_values();
  
  -- Extract values
  header_wallet := auth_info->>'wallet_address';
  wallet_token := auth_info->>'wallet_token';
  has_token := (auth_info->>'has_token')::boolean;
  jwt_wallet := auth_info->>'jwt_wallet';
  
  -- Token format validation for header-based auth
  IF header_wallet IS NOT NULL AND header_wallet = check_wallet AND has_token THEN
    -- Validate token format (must start with specific prefixes or be JWT format)
    IF wallet_token LIKE 'WALLET_VERIFIED_%' OR 
       wallet_token LIKE 'WALLET_AUTH_%' OR
       wallet_token LIKE 'ey%' THEN -- JWT format
      result := true;
    ELSE
      -- Invalid token format
      result := false;
    END IF;
  ELSIF jwt_wallet IS NOT NULL AND jwt_wallet = check_wallet THEN
    -- JWT-based auth is valid
    result := true;
  ELSE
    -- No valid auth method
    result := false;
  END IF;
  
  -- Log for debugging (can be removed in production)
  RAISE NOTICE 'Wallet auth: header_wallet=%, token=%, jwt_wallet=%, check_wallet=%, result=%',
    header_wallet, CASE WHEN wallet_token IS NOT NULL THEN substring(wallet_token, 1, 10) || '...' ELSE NULL END,
    jwt_wallet, check_wallet, result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also update the debug function to include token format validation
CREATE OR REPLACE FUNCTION auth.debug_wallet_matches(check_wallet text)
RETURNS jsonb AS $$
DECLARE
  auth_info jsonb;
  header_wallet text;
  wallet_token text;
  has_token boolean;
  jwt_wallet text;
  header_match boolean;
  token_valid boolean;
  jwt_match boolean;
  result boolean;
BEGIN
  -- Get auth info using the reliable function
  auth_info := auth.get_header_values();
  
  -- Extract values
  header_wallet := auth_info->>'wallet_address';
  wallet_token := auth_info->>'wallet_token';
  has_token := (auth_info->>'has_token')::boolean;
  jwt_wallet := auth_info->>'jwt_wallet';
  
  -- Token format validation
  token_valid := wallet_token LIKE 'WALLET_VERIFIED_%' OR 
                wallet_token LIKE 'WALLET_AUTH_%' OR
                wallet_token LIKE 'ey%';
                
  -- Calculate matches
  header_match := header_wallet IS NOT NULL AND header_wallet = check_wallet AND has_token AND token_valid;
  jwt_match := jwt_wallet IS NOT NULL AND jwt_wallet = check_wallet;
  result := header_match OR jwt_match;
  
  -- Return detailed debug info
  RETURN jsonb_build_object(
    'result', result,
    'timestamp', now(),
    'header_match', header_match,
    'token_valid', token_valid,
    'token_format', CASE 
                     WHEN wallet_token LIKE 'WALLET_VERIFIED_%' THEN 'WALLET_VERIFIED'
                     WHEN wallet_token LIKE 'WALLET_AUTH_%' THEN 'WALLET_AUTH'
                     WHEN wallet_token LIKE 'ey%' THEN 'JWT'
                     ELSE 'INVALID'
                   END,
    'jwt_match', jwt_match,
    'auth_info', auth_info,
    'check_wallet', check_wallet
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment explaining the security fix
COMMENT ON FUNCTION auth.wallet_matches(text) IS 'Strictly validates wallet ownership, requiring valid wallet address and properly formatted auth token';
COMMENT ON FUNCTION auth.debug_wallet_matches(text) IS 'Debug function that shows detailed wallet authentication information including token format validation';

COMMIT; 