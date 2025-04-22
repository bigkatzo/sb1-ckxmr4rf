-- Fix direct access to orders table
BEGIN;

-- Update the RLS policy for direct orders table access
DROP POLICY IF EXISTS "orders_user_view" ON orders;
DROP POLICY IF EXISTS "orders_user_direct_access" ON orders;

-- Create a comprehensive policy that works with both header auth and JWT
CREATE POLICY "orders_user_access"
ON orders
FOR SELECT
TO authenticated, anon
USING (
  -- Allow if wallet matches via header or JWT
  auth.wallet_matches(wallet_address)
  OR
  -- Allow admin access
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = auth.uid()
    AND up.role = 'admin'
  )
);

-- Add a direct query RPC function for clients to use as a more reliable fallback
CREATE OR REPLACE FUNCTION get_wallet_orders(wallet_addr text)
RETURNS SETOF orders AS $$
BEGIN
  -- Check if user is authorized to access this wallet's orders
  IF auth.wallet_matches(wallet_addr) OR
     EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = auth.uid() AND up.role = 'admin')
  THEN
    -- Return orders
    RETURN QUERY 
    SELECT * FROM orders
    WHERE wallet_address = wallet_addr
    ORDER BY created_at DESC;
  ELSE
    -- Not authorized
    RAISE EXCEPTION 'Not authorized to access orders for wallet %', wallet_addr;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_wallet_orders(text) TO authenticated, anon;

-- Add debugging options
CREATE OR REPLACE FUNCTION debug_auth_status()
RETURNS jsonb AS $$
DECLARE
  auth_info jsonb;
  has_token boolean;
BEGIN
  -- Get current authentication details
  auth_info := auth.get_header_values();
  has_token := (auth_info->>'has_token')::boolean;
  
  -- Return comprehensive debug info
  RETURN jsonb_build_object(
    'headers', auth_info,
    'auth_uid', auth.uid(),
    'auth_role', current_setting('request.jwt.claims', true)::jsonb->>'role',
    'is_admin', EXISTS (
      SELECT 1 FROM user_profiles up 
      WHERE up.id = auth.uid() 
      AND up.role = 'admin'
    ),
    'has_wallet_header', auth_info->>'wallet_address' IS NOT NULL,
    'has_wallet_token', has_token,
    'has_jwt_wallet', auth_info->>'jwt_wallet' IS NOT NULL,
    'timestamp', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION debug_auth_status() TO authenticated, anon;

COMMIT; 