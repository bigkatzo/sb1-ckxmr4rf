-- Add support for wallet verification via custom headers
BEGIN;

-- First, create a function to extract wallet address from request headers
CREATE OR REPLACE FUNCTION extract_wallet_from_headers()
RETURNS text AS $$
DECLARE
  wallet_address text;
  wallet_token text;
  expiry_part text;
  expiry_time bigint;
  current_epoch bigint;
BEGIN
  -- Try to get the wallet address from X-Wallet-Address header
  BEGIN
    wallet_address := current_setting('request.headers.x-wallet-address', true);
    
    -- If we have a wallet address from the header
    IF wallet_address IS NOT NULL AND wallet_address != '' THEN
      -- Check if we have a verification token too
      BEGIN
        wallet_token := current_setting('request.headers.x-wallet-auth-token', true);
        
        -- If we have a token, verify it has the correct format with wallet address
        IF wallet_token IS NOT NULL AND wallet_token != '' THEN
          -- Basic check: token must contain the wallet address
          IF wallet_token LIKE '%' || wallet_address || '%' THEN
            -- More specific check: should match our token format
            IF wallet_token LIKE 'WALLET_VERIFIED_%_EXP_%_SIG_%' THEN
              -- Extract expiry from token
              BEGIN
                -- Get the part between EXP_ and _SIG
                expiry_part := substring(wallet_token from 'EXP_([0-9]+)_SIG_');
                
                -- If we got a valid numeric part
                IF expiry_part ~ '^[0-9]+$' THEN
                  -- Convert to number
                  expiry_time := expiry_part::bigint;
                  -- Get current time in milliseconds
                  current_epoch := (extract(epoch from now()) * 1000)::bigint;
                  
                  -- Check if token is expired
                  IF current_epoch <= expiry_time THEN
                    -- Token is valid and not expired
                    RETURN wallet_address;
                  END IF;
                END IF;
              EXCEPTION WHEN OTHERS THEN
                -- Token validation failed, continue
                RAISE NOTICE 'Token expiry validation failed: %', SQLERRM;
              END;
            END IF;
          END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- Continue if token verification fails
        RAISE NOTICE 'Token validation exception: %', SQLERRM;
      END;
      
      -- Even if token validation failed, we still have a wallet address from the header
      -- We can return it if we want to trust the header without token verification
      -- Uncomment the next line to enable this:
      -- RETURN wallet_address;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Continue to next method if header extraction fails
    RAISE NOTICE 'Header extraction failed: %', SQLERRM;
  END;
  
  -- Fall back to JWT-based methods (from existing extract_wallet_from_jwt function)
  BEGIN
    RETURN extract_wallet_from_jwt();
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'JWT extraction failed: %', SQLERRM;
    RETURN NULL;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION extract_wallet_from_headers() TO authenticated;

-- Update the check_wallet_access function to use the new header extraction
CREATE OR REPLACE FUNCTION check_wallet_access(wallet_addr text)
RETURNS boolean AS $$
DECLARE
  jwt_or_header_wallet text;
BEGIN
  -- Get the wallet from headers or JWT
  jwt_or_header_wallet := extract_wallet_from_headers();
  
  -- Direct match
  IF jwt_or_header_wallet = wallet_addr THEN
    RETURN true;
  END IF;
  
  -- No match found
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add a debug function to help troubleshoot wallet verification
CREATE OR REPLACE FUNCTION debug_wallet_verification(target_wallet text) 
RETURNS jsonb AS $$
DECLARE
  result jsonb;
  header_wallet text;
  header_token text;
  jwt_wallet text;
BEGIN
  -- Collect all verification information in one object
  result := jsonb_build_object(
    'target_wallet', target_wallet,
    'verification_methods', jsonb_build_object()
  );
  
  -- Check header-based verification
  BEGIN
    header_wallet := current_setting('request.headers.x-wallet-address', true);
    result := jsonb_set(result, '{verification_methods, header}', 
      jsonb_build_object(
        'present', header_wallet IS NOT NULL AND header_wallet != '',
        'value', COALESCE(header_wallet, ''),
        'matches_target', header_wallet = target_wallet
      )
    );
  EXCEPTION WHEN OTHERS THEN
    result := jsonb_set(result, '{verification_methods, header}', 
      jsonb_build_object(
        'present', false,
        'error', SQLERRM
      )
    );
  END;
  
  -- Check token verification
  BEGIN
    header_token := current_setting('request.headers.x-wallet-auth-token', true);
    result := jsonb_set(result, '{verification_methods, token}', 
      jsonb_build_object(
        'present', header_token IS NOT NULL AND header_token != '',
        'token_excerpt', CASE WHEN header_token IS NOT NULL 
                             THEN substring(header_token from 1 for 30) || '...' 
                             ELSE NULL END,
        'valid_format', header_token LIKE 'WALLET_VERIFIED_%_EXP_%_SIG_%',
        'contains_wallet', CASE WHEN header_token IS NOT NULL AND target_wallet IS NOT NULL
                               THEN header_token LIKE '%' || target_wallet || '%'
                               ELSE false END
      )
    );
  EXCEPTION WHEN OTHERS THEN
    result := jsonb_set(result, '{verification_methods, token}', 
      jsonb_build_object(
        'present', false,
        'error', SQLERRM
      )
    );
  END;
  
  -- Check jwt-based verification
  BEGIN
    jwt_wallet := extract_wallet_from_jwt();
    result := jsonb_set(result, '{verification_methods, jwt}', 
      jsonb_build_object(
        'present', jwt_wallet IS NOT NULL AND jwt_wallet != '',
        'value', COALESCE(jwt_wallet, ''),
        'matches_target', jwt_wallet = target_wallet
      )
    );
  EXCEPTION WHEN OTHERS THEN
    result := jsonb_set(result, '{verification_methods, jwt}', 
      jsonb_build_object(
        'present', false,
        'error', SQLERRM
      )
    );
  END;
  
  -- Add overall verification result
  result := jsonb_set(result, '{verification_result}', 
    to_jsonb(check_wallet_access(target_wallet))
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION debug_wallet_verification(text) TO authenticated;

COMMIT; 