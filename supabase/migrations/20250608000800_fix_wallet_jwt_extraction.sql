-- Enhanced wallet JWT extraction to fix orders view filtering
BEGIN;

-- Create a more robust function to extract wallet address from any JWT location
CREATE OR REPLACE FUNCTION extract_wallet_from_jwt()
RETURNS text AS $$
DECLARE
  jwt_claims_raw text;
  jwt_claims jsonb;
  extracted_wallet text := NULL;
BEGIN
  -- Get the raw JWT claims
  BEGIN
    jwt_claims_raw := current_setting('request.jwt.claims', true);
    
    -- Try to parse as JSON
    BEGIN
      jwt_claims := jwt_claims_raw::jsonb;
    EXCEPTION WHEN OTHERS THEN
      RETURN NULL;
    END;
    
    -- Try all possible locations where wallet could be stored
    
    -- 1. Direct in JWT claims
    IF jwt_claims ? 'wallet_address' THEN
      extracted_wallet := jwt_claims->>'wallet_address';
      IF extracted_wallet IS NOT NULL AND extracted_wallet != '' THEN
        RETURN extracted_wallet;
      END IF;
    END IF;
    
    -- 2. In user_metadata
    IF jwt_claims ? 'user_metadata' AND 
       jwt_claims->'user_metadata' ? 'wallet_address' THEN
      extracted_wallet := jwt_claims->'user_metadata'->>'wallet_address';
      IF extracted_wallet IS NOT NULL AND extracted_wallet != '' THEN
        RETURN extracted_wallet;
      END IF;
    END IF;
    
    -- 3. In app_metadata
    IF jwt_claims ? 'app_metadata' AND 
       jwt_claims->'app_metadata' ? 'wallet_address' THEN
      extracted_wallet := jwt_claims->'app_metadata'->>'wallet_address';
      IF extracted_wallet IS NOT NULL AND extracted_wallet != '' THEN
        RETURN extracted_wallet;
      END IF;
    END IF;
    
    -- 4. In raw_jwt field if it exists and can be parsed
    IF jwt_claims ? 'raw_jwt' THEN
      BEGIN
        DECLARE
          parsed_raw_jwt jsonb;
        BEGIN
          parsed_raw_jwt := jwt_claims->>'raw_jwt'::jsonb;
          
          -- Check in parsed raw_jwt user_metadata
          IF parsed_raw_jwt ? 'user_metadata' AND 
             parsed_raw_jwt->'user_metadata' ? 'wallet_address' THEN
            extracted_wallet := parsed_raw_jwt->'user_metadata'->>'wallet_address';
            IF extracted_wallet IS NOT NULL AND extracted_wallet != '' THEN
              RETURN extracted_wallet;
            END IF;
          END IF;
          
          -- Check in parsed raw_jwt app_metadata
          IF parsed_raw_jwt ? 'app_metadata' AND 
             parsed_raw_jwt->'app_metadata' ? 'wallet_address' THEN
            extracted_wallet := parsed_raw_jwt->'app_metadata'->>'wallet_address';
            IF extracted_wallet IS NOT NULL AND extracted_wallet != '' THEN
              RETURN extracted_wallet;
            END IF;
          END IF;
          
          -- Check direct in parsed raw_jwt
          IF parsed_raw_jwt ? 'wallet_address' THEN
            extracted_wallet := parsed_raw_jwt->>'wallet_address';
            IF extracted_wallet IS NOT NULL AND extracted_wallet != '' THEN
              RETURN extracted_wallet;
            END IF;
          END IF;
        EXCEPTION WHEN OTHERS THEN
          -- Continue to fallback methods
          NULL;
        END;
      END;
    END IF;
    
    -- 5. As a fallback, try string parsing if raw_jwt is a string
    IF jwt_claims ? 'raw_jwt' AND 
       pg_typeof(jwt_claims->>'raw_jwt')::text = 'text' THEN
      DECLARE
        raw_jwt_str text;
        wallet_start int;
        wallet_end int;
      BEGIN
        raw_jwt_str := jwt_claims->>'raw_jwt';
        
        -- Look for various patterns
        wallet_start := position('"wallet_address":"' in raw_jwt_str);
        
        IF wallet_start > 0 THEN
          wallet_start := wallet_start + 17; -- Length of '"wallet_address":"'
          wallet_end := position('"' in substring(raw_jwt_str from wallet_start));
          
          IF wallet_end > 0 THEN
            extracted_wallet := substring(raw_jwt_str from wallet_start for wallet_end - 1);
            IF extracted_wallet IS NOT NULL AND extracted_wallet != '' THEN
              RETURN extracted_wallet;
            END IF;
          END IF;
        END IF;
      END;
    END IF;
    
    -- 6. Last try - direct current_setting checks for all known paths
    extracted_wallet := nullif(current_setting('request.jwt.claim.wallet_address', true), '');
    IF extracted_wallet IS NOT NULL AND extracted_wallet != '' THEN
      RETURN extracted_wallet;
    END IF;
    
    extracted_wallet := nullif(current_setting('request.jwt.claim.user_metadata.wallet_address', true), '');
    IF extracted_wallet IS NOT NULL AND extracted_wallet != '' THEN
      RETURN extracted_wallet;
    END IF;
    
    extracted_wallet := nullif(current_setting('request.jwt.claim.app_metadata.wallet_address', true), '');
    IF extracted_wallet IS NOT NULL AND extracted_wallet != '' THEN
      RETURN extracted_wallet;
    END IF;
    
  EXCEPTION WHEN OTHERS THEN
    -- Ignore errors in JWT parsing
    RETURN NULL;
  END;
  
  -- No wallet found in any location
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the check_wallet_access function to use our new extractor
CREATE OR REPLACE FUNCTION check_wallet_access(wallet_addr text)
RETURNS boolean AS $$
DECLARE
  jwt_wallet text;
BEGIN
  -- Extract wallet from JWT
  jwt_wallet := extract_wallet_from_jwt();
  
  -- Compare with the target wallet
  IF jwt_wallet IS NOT NULL AND jwt_wallet = wallet_addr THEN
    RETURN true;
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

-- Create a simpler user_orders view that uses our improved functions
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
    o.variant_selections,
    o.product_snapshot,
    o.collection_snapshot,
    o.payment_metadata,
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
    -- Use our new function that handles all JWT structures
    o.wallet_address = extract_wallet_from_jwt()
    OR check_wallet_access(o.wallet_address);

-- Improve row-level security on orders table
DROP POLICY IF EXISTS "orders_user_view" ON orders;

CREATE POLICY "orders_user_view" 
ON orders
FOR SELECT
TO authenticated
USING (
    wallet_address = extract_wallet_from_jwt()
    OR check_wallet_access(wallet_address)
);

-- Grant permissions
GRANT SELECT ON user_orders TO authenticated;
GRANT EXECUTE ON FUNCTION extract_wallet_from_jwt() TO authenticated;
GRANT EXECUTE ON FUNCTION check_wallet_access(text) TO authenticated;

-- Add comments
COMMENT ON FUNCTION extract_wallet_from_jwt() IS 'Comprehensive function to extract wallet address from any location in JWT';
COMMENT ON FUNCTION check_wallet_access(text) IS 'Improved wallet access check that uses multiple methods to verify wallet ownership';
COMMENT ON VIEW user_orders IS 'Enhanced user orders view that reliably extracts wallet address from JWT regardless of structure';

COMMIT; 