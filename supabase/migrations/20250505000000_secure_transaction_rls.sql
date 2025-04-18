-- Start transaction
BEGIN;

-- ===============================================================
-- RESTRICT CRITICAL TRANSACTION FUNCTIONS TO AUTHENTICATED USERS
-- ===============================================================

-- First, check what functions we're dealing with
DO $$
DECLARE
    func_info RECORD;
BEGIN
    RAISE NOTICE 'Listing transaction-related functions with their parameter types:';
    FOR func_info IN 
        SELECT 
            p.proname AS function_name,
            pg_get_function_identity_arguments(p.oid) AS arg_list
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname IN ('update_transaction_status', 'confirm_order_payment', 
                         'update_order_transaction', 'confirm_order_transaction', 
                         'verify_transaction_status')
        ORDER BY p.proname, pg_get_function_identity_arguments(p.oid)
    LOOP
        RAISE NOTICE 'Function: %(%) ', func_info.function_name, func_info.arg_list;
    END LOOP;
END $$;

-- Revoke execution privileges from anon users for critical functions with specific signatures
-- Using the exact function signature to avoid ambiguity

-- For update_transaction_status function
REVOKE EXECUTE ON FUNCTION update_transaction_status(p_signature text, p_status text, p_details jsonb) FROM anon;

-- For confirm_order_payment function
REVOKE EXECUTE ON FUNCTION confirm_order_payment(p_transaction_signature text, p_status text) FROM anon;

-- For update_order_transaction function
REVOKE EXECUTE ON FUNCTION update_order_transaction(p_order_id uuid, p_transaction_signature text, p_amount_sol numeric) FROM anon;

-- For confirm_order_transaction function
REVOKE EXECUTE ON FUNCTION confirm_order_transaction(p_order_id uuid) FROM anon;

-- For verify_transaction_status function
REVOKE EXECUTE ON FUNCTION verify_transaction_status(p_signature text, p_expected_amount numeric, p_expected_buyer text, p_order_id uuid) FROM anon;

-- Allow authenticated users to call these functions with specific signatures
GRANT EXECUTE ON FUNCTION update_transaction_status(p_signature text, p_status text, p_details jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION confirm_order_payment(p_transaction_signature text, p_status text) TO authenticated;
GRANT EXECUTE ON FUNCTION update_order_transaction(p_order_id uuid, p_transaction_signature text, p_amount_sol numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION confirm_order_transaction(p_order_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION verify_transaction_status(p_signature text, p_expected_amount numeric, p_expected_buyer text, p_order_id uuid) TO authenticated;

-- Allow service_role (used by server functions) to call all functions with specific signatures
GRANT EXECUTE ON FUNCTION update_transaction_status(p_signature text, p_status text, p_details jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION confirm_order_payment(p_transaction_signature text, p_status text) TO service_role;
GRANT EXECUTE ON FUNCTION update_order_transaction(p_order_id uuid, p_transaction_signature text, p_amount_sol numeric) TO service_role;
GRANT EXECUTE ON FUNCTION confirm_order_transaction(p_order_id uuid) TO service_role;
GRANT EXECUTE ON FUNCTION verify_transaction_status(p_signature text, p_expected_amount numeric, p_expected_buyer text, p_order_id uuid) TO service_role;

-- ===============================================================
-- SECURE ORDERS TABLE ACCESS
-- ===============================================================

-- Drop existing order RLS policies if they exist
DROP POLICY IF EXISTS "Public users can view their orders" ON orders;
DROP POLICY IF EXISTS "Public users can create orders" ON orders;
DROP POLICY IF EXISTS "Public users can update their orders" ON orders;

-- Enable RLS on orders table
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Create secure RLS policies for orders table
CREATE POLICY "Authenticated users can view their orders"
ON orders FOR SELECT
TO authenticated
USING (wallet_address = auth.jwt() ->> 'sub' OR wallet_address IS NULL);

CREATE POLICY "Authenticated users can create orders"
ON orders FOR INSERT
TO authenticated
WITH CHECK (wallet_address = auth.jwt() ->> 'sub' OR wallet_address IS NULL);

CREATE POLICY "Authenticated users can update their orders"
ON orders FOR UPDATE
TO authenticated
USING (wallet_address = auth.jwt() ->> 'sub')
WITH CHECK (wallet_address = auth.jwt() ->> 'sub');

-- ===============================================================
-- SECURE TRANSACTIONS TABLE ACCESS
-- ===============================================================

-- Drop existing transaction RLS policies if they exist
DROP POLICY IF EXISTS "Public users can view transactions" ON transactions;
DROP POLICY IF EXISTS "Public users can create transactions" ON transactions;
DROP POLICY IF EXISTS "Public users can update their transactions" ON transactions;

-- Enable RLS on transactions table
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Create secure RLS policies for transactions table
CREATE POLICY "Authenticated users can view their transactions"
ON transactions FOR SELECT
TO authenticated
USING (
  buyer_address = auth.jwt() ->> 'sub' OR 
  EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.transaction_signature = transactions.signature 
    AND orders.wallet_address = auth.jwt() ->> 'sub'
  )
);

CREATE POLICY "Authenticated users can create transactions"
ON transactions FOR INSERT
TO authenticated
WITH CHECK (buyer_address = auth.jwt() ->> 'sub');

CREATE POLICY "Authenticated users can update their transactions"
ON transactions FOR UPDATE
TO authenticated
USING (buyer_address = auth.jwt() ->> 'sub');

-- Grant service_role full access for server-side operations
GRANT ALL ON orders TO service_role;
GRANT ALL ON transactions TO service_role;

-- ===============================================================
-- CREATE NEW SECURE VERIFICATION FUNCTIONS
-- ===============================================================

-- Function to verify a transaction on-chain (server-side only)
CREATE OR REPLACE FUNCTION admin_verify_transaction(
  p_signature text,
  p_expected_amount numeric DEFAULT NULL,
  p_expected_buyer text DEFAULT NULL,
  p_order_id uuid DEFAULT NULL
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_result jsonb;
  v_transaction_data jsonb;
BEGIN
  -- This is a placeholder function that would be called by server-side functions
  -- The actual verification would happen in the Netlify functions we created
  -- This function exists as a security measure to ensure verification can only happen
  -- through our secured server endpoints
  
  RAISE EXCEPTION 'Direct database verification is disabled. Use the secure server-side verification API instead.';
  
  -- In production, this would never execute due to the above exception
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Direct database verification is disabled. Use the secure server-side verification API.'
  );
END;
$$;

-- Only grant execution to service_role (server functions)
REVOKE EXECUTE ON FUNCTION admin_verify_transaction FROM public;
REVOKE EXECUTE ON FUNCTION admin_verify_transaction FROM authenticated;
REVOKE EXECUTE ON FUNCTION admin_verify_transaction FROM anon;
GRANT EXECUTE ON FUNCTION admin_verify_transaction TO service_role;

-- Add logging for security-related events
CREATE TABLE IF NOT EXISTS security_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  action text NOT NULL,
  user_id text,
  details jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create index on security_logs
CREATE INDEX IF NOT EXISTS idx_security_logs_user_id ON security_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_action ON security_logs(action);

-- Function to log security events
CREATE OR REPLACE FUNCTION log_security_event(
  p_action text,
  p_details jsonb DEFAULT NULL
)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO security_logs(action, user_id, details)
  VALUES (
    p_action,
    COALESCE(auth.uid()::text, 'anonymous'),
    p_details
  );
END;
$$;

-- Grant appropriate permissions
GRANT EXECUTE ON FUNCTION log_security_event TO authenticated;
GRANT EXECUTE ON FUNCTION log_security_event TO service_role;

-- Add trigger to log order confirmation attempts
CREATE OR REPLACE FUNCTION trigger_log_order_confirmation()
RETURNS trigger
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM log_security_event(
    'order_confirmation_attempt',
    jsonb_build_object(
      'order_id', NEW.id,
      'old_status', OLD.status,
      'new_status', NEW.status,
      'wallet_address', NEW.wallet_address,
      'transaction_signature', NEW.transaction_signature
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER log_order_confirmation_trigger
AFTER UPDATE OF status ON orders
FOR EACH ROW
WHEN (OLD.status = 'pending_payment' AND NEW.status = 'confirmed')
EXECUTE FUNCTION trigger_log_order_confirmation();

COMMIT; 