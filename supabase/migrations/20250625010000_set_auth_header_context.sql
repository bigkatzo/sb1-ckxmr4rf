-- Migration to fix wallet authentication by setting header values as database context variables
BEGIN;

-- Create a function to set wallet header as a database setting
CREATE OR REPLACE FUNCTION public.set_wallet_header_context()
RETURNS VOID AS $$
DECLARE
  wallet_header text;
BEGIN
  -- Try to get wallet address from header
  BEGIN
    wallet_header := current_setting('request.headers.x-wallet-address', true);
    
    -- If wallet header exists, store it in local context for this transaction
    IF wallet_header IS NOT NULL THEN
      -- Set as database setting that RLS policies can access
      PERFORM set_config('auth.wallet_address', wallet_header, true);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Silently handle errors
    NULL;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a RLS helper function to set the context and then check
CREATE OR REPLACE FUNCTION public.check_wallet_with_header_context(wallet_addr text)
RETURNS boolean AS $$
BEGIN
  -- First set the context from headers
  PERFORM public.set_wallet_header_context();
  
  -- Then check if the wallet matches the current user's wallet
  RETURN wallet_addr = public.current_user_wallet_address();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function that gives easy access to the current wallet address (from header or JWT)
CREATE OR REPLACE FUNCTION public.current_user_wallet_address()
RETURNS text AS $$
DECLARE
  wallet_address text;
BEGIN
  -- First try to get wallet from local context setting
  BEGIN
    wallet_address := current_setting('auth.wallet_address', true);
    IF wallet_address IS NOT NULL AND wallet_address != '' THEN
      RETURN wallet_address;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  -- Next, try to get from JWT metadata
  BEGIN 
    wallet_address := auth.jwt()->'user_metadata'->>'wallet_address';
    IF wallet_address IS NOT NULL AND wallet_address != '' THEN
      RETURN wallet_address;
    END IF;
    
    -- Try root JWT claim
    wallet_address := auth.jwt()->>'wallet_address';
    IF wallet_address IS NOT NULL AND wallet_address != '' THEN
      RETURN wallet_address;
    END IF;
    
    -- Try app_metadata claim
    wallet_address := auth.jwt()->'app_metadata'->>'wallet_address';
    IF wallet_address IS NOT NULL AND wallet_address != '' THEN
      RETURN wallet_address;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  -- No wallet found
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the wallet_owner_view_orders policy to use our headers-aware function
DROP POLICY IF EXISTS "wallet_owner_view_orders" ON orders;

CREATE POLICY "wallet_owner_view_orders"
ON orders
FOR SELECT
TO authenticated
USING (
  -- Use the function that sets context and then checks wallet
  public.check_wallet_with_header_context(wallet_address)
);

-- Fix the user_orders view
DROP VIEW IF EXISTS user_orders;

-- Create a more direct version of the view that uses our header-aware function
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
    -- Use our header-aware function to check wallet ownership
    public.check_wallet_with_header_context(o.wallet_address);

-- Grant permissions
GRANT SELECT ON user_orders TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_wallet_address() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_wallet_header_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_wallet_with_header_context(text) TO authenticated;

-- Add comments
COMMENT ON FUNCTION public.set_wallet_header_context() IS 'Sets wallet address from header as database context variable for RLS policies';
COMMENT ON FUNCTION public.current_user_wallet_address() IS 'Gets current wallet address from header context or JWT';
COMMENT ON FUNCTION public.check_wallet_with_header_context(text) IS 'Checks if wallet matches current user, after setting context from headers';
COMMENT ON VIEW user_orders IS 'User-facing view of orders with support for header-based wallet identification';

COMMIT; 