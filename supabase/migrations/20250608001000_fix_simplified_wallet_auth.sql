-- Fix for simplified wallet authentication that doesn't rely on JWT claims
BEGIN;

-- Create a custom function to validate wallet tokens directly
CREATE OR REPLACE FUNCTION validate_simplified_wallet_auth(auth_token text, wallet_addr text)
RETURNS boolean AS $$
DECLARE
  token_parts text[];
  token_payload jsonb;
  token_wallet text;
BEGIN
  -- Very simple token validation for the simplified wallet auth flow
  -- This is specifically for handling the case where we have a custom wallet token
  -- but it's not stored in the standard JWT claims structure
  
  -- Check if this is our custom wallet JWT format
  IF auth_token IS NULL OR wallet_addr IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if this is our simplified format with the WALLET_AUTH_SIGNATURE marker
  IF position('WALLET_AUTH_SIGNATURE' in auth_token) > 0 THEN
    -- This is our simplified wallet auth token
    -- Extract the embedded wallet address (format: prefix_walletAddress_suffix)
    BEGIN
      -- Parse the token to find wallet address
      token_parts := regexp_split_to_array(auth_token, '_');
      
      -- If token has the correct format, second part should be wallet address
      IF array_length(token_parts, 1) >= 3 THEN
        token_wallet := token_parts[2];
        
        -- Compare extracted wallet against target wallet
        IF token_wallet = wallet_addr THEN
          RETURN true;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- If parsing fails, return false
      RETURN false;
    END;
  END IF;
  
  -- Try to parse it as a regular JWT if not our simplified format
  BEGIN
    token_parts := regexp_split_to_array(auth_token, '\.');
    
    -- Check if we have a valid JWT structure (3 parts)
    IF array_length(token_parts, 1) = 3 THEN
      -- Decode the payload (middle part)
      token_payload := convert_from(
        decode(
          regexp_replace(token_parts[2], '-_', '+/'),
          'base64'
        ),
        'utf8'
      )::jsonb;
      
      -- Check if wallet address is present and matches
      IF token_payload ? 'wallet_address' AND token_payload->>'wallet_address' = wallet_addr THEN
        RETURN true;
      END IF;
      
      -- Check in user_metadata
      IF token_payload ? 'user_metadata' AND 
         token_payload->'user_metadata' ? 'wallet_address' AND
         token_payload->'user_metadata'->>'wallet_address' = wallet_addr THEN
        RETURN true;
      END IF;
      
      -- Check in app_metadata
      IF token_payload ? 'app_metadata' AND 
         token_payload->'app_metadata' ? 'wallet_address' AND
         token_payload->'app_metadata'->>'wallet_address' = wallet_addr THEN
        RETURN true;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- If JWT parsing fails, return false
    RETURN false;
  END;
  
  -- No match found
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a secure utility function to extract auth token from request headers
CREATE OR REPLACE FUNCTION get_auth_token()
RETURNS text AS $$
DECLARE
  auth_header text;
  token text;
BEGIN
  -- Get the Authorization header
  auth_header := current_setting('request.headers', true)::jsonb->'authorization'::text;
  
  -- Extract token from 'Bearer token' format
  IF auth_header IS NOT NULL AND auth_header != 'null' THEN
    token := regexp_replace(auth_header, '^"?Bearer\s+([^\s"]+)"?$', '\1', 'i');
    RETURN token;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the check_wallet_access function to also check for simplified wallet auth
CREATE OR REPLACE FUNCTION check_wallet_access(wallet_addr text)
RETURNS boolean AS $$
DECLARE
  jwt_wallet text;
  auth_token text;
BEGIN
  -- Extract wallet from JWT
  jwt_wallet := extract_wallet_from_jwt();
  
  -- Direct JWT wallet match
  IF jwt_wallet IS NOT NULL AND jwt_wallet = wallet_addr THEN
    RETURN true;
  END IF;
  
  -- Get auth token from request headers for simplified auth
  auth_token := get_auth_token();
  
  -- Check simplified wallet auth if token is available
  IF auth_token IS NOT NULL THEN
    IF validate_simplified_wallet_auth(auth_token, wallet_addr) THEN
      RETURN true;
    END IF;
  END IF;
  
  -- If no match and we have auth.uid(), check wallets table
  IF auth.uid() IS NOT NULL THEN
    BEGIN
      RETURN EXISTS (
        SELECT 1 
        FROM wallets 
        WHERE wallet_address = wallet_addr 
        AND user_id = auth.uid()
      );
    EXCEPTION WHEN undefined_table THEN
      -- Wallets table doesn't exist, continue
      NULL;
    END;
  END IF;
  
  -- No matches found
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION validate_simplified_wallet_auth(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_auth_token() TO authenticated;
GRANT EXECUTE ON FUNCTION check_wallet_access(text) TO authenticated;

-- Add comments
COMMENT ON FUNCTION validate_simplified_wallet_auth(text, text) IS 'Validates simplified wallet authentication tokens that might not be in standard JWT format';
COMMENT ON FUNCTION get_auth_token() IS 'Utility function to extract auth token from request headers';
COMMENT ON FUNCTION check_wallet_access(text) IS 'Enhanced wallet access check with support for simplified wallet auth tokens';

COMMIT; 