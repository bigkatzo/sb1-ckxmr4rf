-- Create a more robust user_orders view that extracts wallet addresses from multiple JWT locations
BEGIN;

-- First, create a helper function to extract wallet address from JWT in multiple ways
CREATE OR REPLACE FUNCTION extract_wallet_from_jwt()
RETURNS text AS $$
DECLARE
  wallet_address text;
BEGIN
  -- Try multiple methods to extract wallet address from JWT
  
  -- 1. Try direct from root level
  BEGIN
    wallet_address := auth.jwt()->>'wallet_address';
    IF wallet_address IS NOT NULL AND wallet_address != '' THEN
      RETURN wallet_address;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Continue to next method
  END;
  
  -- 2. Try from user_metadata
  BEGIN
    wallet_address := auth.jwt()->'user_metadata'->>'wallet_address';
    IF wallet_address IS NOT NULL AND wallet_address != '' THEN
      RETURN wallet_address;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Continue to next method
  END;
  
  -- 3. Try from app_metadata
  BEGIN
    wallet_address := auth.jwt()->'app_metadata'->>'wallet_address';
    IF wallet_address IS NOT NULL AND wallet_address != '' THEN
      RETURN wallet_address;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Continue to next method
  END;
  
  -- 4. Try parsing WALLET_AUTH_SIGNATURE format from token
  -- This requires access to the raw token which we don't have in this context
  
  RETURN NULL; -- No wallet address found
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION extract_wallet_from_jwt() TO authenticated;

-- Create a function to check wallet access using various methods
CREATE OR REPLACE FUNCTION check_wallet_access(wallet_addr text)
RETURNS boolean AS $$
DECLARE
  jwt_wallet text;
BEGIN
  -- Get the wallet from JWT
  jwt_wallet := extract_wallet_from_jwt();
  
  -- Direct match
  IF jwt_wallet = wallet_addr THEN
    RETURN true;
  END IF;
  
  -- No match found
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_wallet_access(text) TO authenticated;

-- Drop existing view
DROP VIEW IF EXISTS user_orders CASCADE;

-- Create updated view with more robust wallet address extraction
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
    ) t1 ON true  -- Always join this subquery
WHERE 
    -- Use the check_wallet_access function for more robust checking
    check_wallet_access(o.wallet_address);

-- Grant permissions
GRANT SELECT ON user_orders TO authenticated;

-- Add comment explaining the view
COMMENT ON VIEW user_orders IS 'User orders view with robust wallet address extraction from JWT';

COMMIT; 