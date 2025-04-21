-- Fix user_orders view and check_wallet_access function to properly extract wallet address from JWT
BEGIN;

-- Create an improved check_wallet_access function that handles JWT parsing better
CREATE OR REPLACE FUNCTION check_wallet_access(wallet_addr text)
RETURNS boolean AS $$
DECLARE
  jwt_claims_raw text;
  jwt_claims jsonb;
  user_meta jsonb;
  extracted_wallet text;
  debug_info jsonb;
  parsed_raw_jwt jsonb;
BEGIN
  -- Try to get the JWT claims
  BEGIN
    jwt_claims_raw := current_setting('request.jwt.claims', true);
    
    -- Parse the main JWT claims
    jwt_claims := jwt_claims_raw::jsonb;
    
    -- First try direct access in claims
    IF jwt_claims ? 'wallet_address' THEN
      extracted_wallet := jwt_claims->>'wallet_address';
      IF extracted_wallet = wallet_addr THEN
        RETURN true;
      END IF;
    END IF;
    
    -- Try to extract from user_metadata directly
    IF jwt_claims ? 'user_metadata' THEN
      user_meta := jwt_claims->'user_metadata';
      IF user_meta ? 'wallet_address' THEN
        extracted_wallet := user_meta->>'wallet_address';
        IF extracted_wallet = wallet_addr THEN
          RETURN true;
        END IF;
      END IF;
    END IF;
    
    -- Handle the case where raw_jwt is a string that needs parsing
    IF jwt_claims ? 'raw_jwt' THEN
      BEGIN
        parsed_raw_jwt := jwt_claims->>'raw_jwt'::jsonb;
        
        -- Look for wallet in the parsed raw_jwt
        IF parsed_raw_jwt ? 'user_metadata' AND 
           parsed_raw_jwt->'user_metadata' ? 'wallet_address' THEN
          extracted_wallet := parsed_raw_jwt->'user_metadata'->>'wallet_address';
          IF extracted_wallet = wallet_addr THEN
            RETURN true;
          END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- Log error but continue with other methods
        RAISE NOTICE 'Error parsing raw_jwt field: %', SQLERRM;
      END;
    END IF;
    
    -- If we have auth.uid(), check wallet association table if it exists
    IF auth.uid() IS NOT NULL THEN
      BEGIN
        RETURN EXISTS (
          SELECT 1 
          FROM wallets 
          WHERE wallet_address = wallet_addr 
          AND user_id = auth.uid()
        );
      EXCEPTION WHEN undefined_table THEN
        -- Wallets table doesn't exist, silently continue
        NULL;
      END;
    END IF;
    
    -- Finally, try an alternative method - direct string parsing since raw_jwt might be a string
    -- that needs manual parsing (can happen in some Supabase JWT structures)
    IF jwt_claims ? 'raw_jwt' THEN
      DECLARE
        raw_jwt_str text;
        wallet_start int;
        wallet_end int;
      BEGIN
        raw_jwt_str := jwt_claims->>'raw_jwt';
        
        -- Look for wallet_address pattern in the string
        wallet_start := position('"wallet_address":"' in raw_jwt_str);
        
        IF wallet_start > 0 THEN
          -- Move to the start of the actual wallet value
          wallet_start := wallet_start + 17; -- Length of '"wallet_address":"'
          
          -- Find the end of the wallet string (next quote)
          wallet_end := position('"' in substring(raw_jwt_str from wallet_start));
          
          IF wallet_end > 0 THEN
            extracted_wallet := substring(raw_jwt_str from wallet_start for wallet_end - 1);
            
            -- Compare extracted wallet with the target wallet
            IF extracted_wallet = wallet_addr THEN
              RETURN true;
            END IF;
          END IF;
        END IF;
      END;
    END IF;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error in check_wallet_access: %', SQLERRM;
    RETURN false;
  END;
  
  -- No matches found
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a better debug function to help troubleshoot
CREATE OR REPLACE FUNCTION debug_jwt_wallet()
RETURNS jsonb AS $$
DECLARE
  jwt_claims_raw text;
  jwt_claims jsonb;
  extracted_wallet text := null;
  sample_wallet text := 'CP9mCLHEk2j9L6RTndQnHoUkyH8qZeEfTgEDtvqcL3Yn';
  debug_info jsonb;
BEGIN
  -- Get raw JWT claims text
  jwt_claims_raw := current_setting('request.jwt.claims', true);
  
  -- Parse as JSONB if possible
  BEGIN
    jwt_claims := jwt_claims_raw::jsonb;
  EXCEPTION WHEN OTHERS THEN
    jwt_claims := jsonb_build_object('error', 'Failed to parse JWT claims as JSON');
  END;
  
  -- Try to extract wallet from various locations
  IF jwt_claims ? 'user_metadata' AND jwt_claims->'user_metadata' ? 'wallet_address' THEN
    extracted_wallet := jwt_claims->'user_metadata'->>'wallet_address';
  END IF;
  
  -- If we have a raw_jwt field, try to parse that too
  IF jwt_claims ? 'raw_jwt' THEN
    BEGIN
      debug_info := jsonb_build_object(
        'raw_jwt_type', pg_typeof(jwt_claims->>'raw_jwt')::text,
        'raw_jwt_length', length(jwt_claims->>'raw_jwt'),
        'contains_wallet_str', position('wallet_address' in jwt_claims->>'raw_jwt') > 0,
        'string_excerpt', substring(jwt_claims->>'raw_jwt' from 1 for 100) || '...'
      );
    EXCEPTION WHEN OTHERS THEN
      debug_info := jsonb_build_object('raw_jwt_error', SQLERRM);
    END;
  END IF;
  
  RETURN jsonb_build_object(
    'wallet_access_works', check_wallet_access(sample_wallet),
    'jwt_data_type', pg_typeof(jwt_claims_raw)::text,
    'jwt_length', length(jwt_claims_raw),
    'extracted_wallet', extracted_wallet,
    'claims_has_user_metadata', jwt_claims ? 'user_metadata',
    'claims_has_raw_jwt', jwt_claims ? 'raw_jwt',
    'raw_jwt_debug', debug_info
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix the user_orders view to use our improved check_wallet_access function
DROP VIEW IF EXISTS user_orders CASCADE;

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
    p.name as product_name,
    p.sku as product_sku,
    COALESCE(
        cat.name,
        (o.product_snapshot->>'category_name')::text
    ) as category_name,
    c.name as collection_name,
    o.variant_selections,
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
                'tracking_events', COALESCE(
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
    END AS tracking,
    CASE
        WHEN o.status = 'delivered' THEN true
        WHEN o.status = 'shipped' AND ot.id IS NOT NULL THEN true
        ELSE false
    END as is_trackable
FROM orders o
JOIN products p ON p.id = o.product_id
JOIN collections c ON c.id = o.collection_id
LEFT JOIN categories cat ON cat.id = p.category_id
LEFT JOIN order_tracking ot ON ot.order_id = o.id
WHERE check_wallet_access(o.wallet_address);

-- Update the orders RLS policy to use our improved function
DROP POLICY IF EXISTS "orders_user_view" ON orders;

CREATE POLICY "orders_user_view"
ON orders
FOR SELECT
TO authenticated
USING (check_wallet_access(wallet_address));

-- Grant permissions
GRANT SELECT ON user_orders TO authenticated;
GRANT EXECUTE ON FUNCTION check_wallet_access(text) TO authenticated;
GRANT EXECUTE ON FUNCTION debug_jwt_wallet() TO authenticated;

-- Add comments
COMMENT ON FUNCTION check_wallet_access(text) IS 'Improved function that handles nested JWT structures to verify wallet ownership';
COMMENT ON FUNCTION debug_jwt_wallet() IS 'Debug function to help troubleshoot JWT wallet extraction issues';
COMMENT ON VIEW user_orders IS 'Fixed user orders view that uses improved wallet verification';

COMMIT; 