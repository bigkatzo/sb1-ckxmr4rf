-- Add direct wallet header verification (complete self-contained solution)
BEGIN;

-- Create a simple function to extract wallet address from request headers
CREATE OR REPLACE FUNCTION get_wallet_from_header()
RETURNS text AS $$
DECLARE
  wallet_address text;
BEGIN
  -- Try to get the wallet address from X-Wallet-Address header
  BEGIN
    wallet_address := current_setting('request.headers.x-wallet-address', true);
    RETURN wallet_address;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_wallet_from_header() TO authenticated;

-- Create a function to check if a token in headers matches the wallet and is valid
CREATE OR REPLACE FUNCTION is_wallet_token_valid()
RETURNS boolean AS $$
DECLARE
  wallet_address text;
  wallet_token text;
  expiry_part text;
  expiry_time bigint;
  current_epoch bigint;
BEGIN
  -- Get wallet address and token from headers
  BEGIN
    wallet_address := current_setting('request.headers.x-wallet-address', true);
    wallet_token := current_setting('request.headers.x-wallet-auth-token', true);
    
    -- If either is missing, return false
    IF wallet_address IS NULL OR wallet_address = '' OR 
       wallet_token IS NULL OR wallet_token = '' THEN
      RETURN false;
    END IF;
    
    -- Check token format matches our expected format
    IF wallet_token NOT LIKE 'WALLET_VERIFIED_%_EXP_%_SIG_%' THEN
      RETURN false;
    END IF;
    
    -- Check token contains wallet address
    IF wallet_token NOT LIKE '%' || wallet_address || '%' THEN
      RETURN false;
    END IF;
    
    -- Extract expiry timestamp
    BEGIN
      -- Get the part between EXP_ and _SIG_
      expiry_part := substring(wallet_token from 'EXP_([0-9]+)_SIG_');
      
      -- If we got a valid numeric part
      IF expiry_part ~ '^[0-9]+$' THEN
        -- Convert to bigint
        expiry_time := expiry_part::bigint;
        -- Get current time in milliseconds
        current_epoch := (extract(epoch from now()) * 1000)::bigint;
        
        -- Check if token is expired
        IF current_epoch <= expiry_time THEN
          -- Token is valid and not expired
          RETURN true;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RETURN false;
    END;
    
    -- If we get here, something failed in validation
    RETURN false;
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_wallet_token_valid() TO authenticated;

-- Update or create the orders_access function to use header verification
CREATE OR REPLACE FUNCTION check_wallet_orders_access(order_wallet_address text)
RETURNS boolean AS $$
DECLARE
  header_wallet text;
  is_token_valid boolean;
BEGIN
  -- Get wallet from header
  header_wallet := get_wallet_from_header();
  
  -- Check if we have a valid wallet in the header
  IF header_wallet IS NOT NULL AND header_wallet != '' THEN
    -- Check if the wallet in the header matches the order's wallet address
    IF header_wallet = order_wallet_address THEN
      -- Verify the token is valid
      is_token_valid := is_wallet_token_valid();
      
      -- If token is valid, grant access
      IF is_token_valid THEN
        RETURN true;
      END IF;
    END IF;
  END IF;
  
  -- If we get here, header verification failed
  -- Now try JWT-based verification as fallback (if it exists)
  BEGIN
    -- Look for wallet in JWT user_metadata first
    DECLARE
      jwt_wallet text;
    BEGIN
      jwt_wallet := auth.jwt()->'user_metadata'->>'wallet_address';
      
      -- If wallet found and matches, grant access
      IF jwt_wallet IS NOT NULL AND jwt_wallet = order_wallet_address THEN
        RETURN true;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Continue to next method
      NULL;
    END;
  EXCEPTION WHEN OTHERS THEN
    -- JWT verification failed or not available
    NULL;
  END;
  
  -- If we get here, both verification methods failed
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_wallet_orders_access(text) TO authenticated;

-- Add a debugging function
CREATE OR REPLACE FUNCTION debug_wallet_header_verification(target_wallet text)
RETURNS jsonb AS $$
DECLARE
  header_wallet text;
  header_token text;
  jwt_wallet text;
  token_valid boolean;
  header_access boolean;
  jwt_access boolean;
  result jsonb;
BEGIN
  -- Initialize result object
  result := jsonb_build_object(
    'target_wallet', target_wallet,
    'verification_methods', jsonb_build_object()
  );
  
  -- Check header-based access
  BEGIN
    header_wallet := get_wallet_from_header();
    token_valid := is_wallet_token_valid();
    header_access := header_wallet IS NOT NULL AND 
                      header_wallet = target_wallet AND 
                      token_valid;
    
    -- Add header info to result
    result := jsonb_set(result, '{verification_methods, header}', jsonb_build_object(
      'wallet_present', header_wallet IS NOT NULL AND header_wallet != '',
      'wallet_value', COALESCE(header_wallet, ''),
      'wallet_matches', header_wallet = target_wallet,
      'token_valid', token_valid,
      'access_granted', header_access
    ));
  EXCEPTION WHEN OTHERS THEN
    result := jsonb_set(result, '{verification_methods, header}', jsonb_build_object(
      'error', SQLERRM
    ));
  END;
  
  -- Check JWT-based access as fallback
  BEGIN
    -- Get wallet from JWT
    jwt_wallet := auth.jwt()->'user_metadata'->>'wallet_address';
    jwt_access := jwt_wallet IS NOT NULL AND jwt_wallet = target_wallet;
    
    -- Add JWT info to result
    result := jsonb_set(result, '{verification_methods, jwt}', jsonb_build_object(
      'wallet_present', jwt_wallet IS NOT NULL AND jwt_wallet != '',
      'wallet_value', COALESCE(jwt_wallet, ''),
      'wallet_matches', jwt_wallet = target_wallet,
      'access_granted', jwt_access
    ));
  EXCEPTION WHEN OTHERS THEN
    result := jsonb_set(result, '{verification_methods, jwt}', jsonb_build_object(
      'error', SQLERRM
    ));
  END;
  
  -- Add overall access result
  result := jsonb_set(result, '{access_granted}', 
    to_jsonb(check_wallet_orders_access(target_wallet))
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION debug_wallet_header_verification(text) TO authenticated;

-- Update the user_orders view to use our new access check function
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
    o.category_name,
    -- Product and collection details from joined tables
    COALESCE(p.name, o.product_name) as product_name,
    COALESCE(p.sku, o.product_sku) as product_sku,
    COALESCE(c.name, o.collection_name) as collection_name,
    -- Include tracking as a JSON field
    t as tracking,
    CASE 
        WHEN o.status = 'delivered' THEN true
        WHEN o.status = 'shipped' AND t IS NOT NULL THEN true
        ELSE false
    END as is_trackable
FROM 
    orders o
    LEFT JOIN products p ON p.id = o.product_id
    LEFT JOIN collections c ON c.id = o.collection_id
    LEFT JOIN LATERAL (
        -- Use a subquery for tracking to create a JSON object
        SELECT to_jsonb(ot.*) as t
        FROM order_tracking ot
        WHERE ot.order_id = o.id
        LIMIT 1
    ) t1 ON true
WHERE 
    -- Use our new access check function
    check_wallet_orders_access(o.wallet_address);

-- Grant permissions
GRANT SELECT ON user_orders TO authenticated;

-- Add comment explaining the view
COMMENT ON VIEW user_orders IS 'User orders view with header-based wallet address verification';

COMMIT; 