-- Fix infinite recursion issues in RLS policies for orders table
BEGIN;

-- Drop any existing problematic RLS policies on orders table
DROP POLICY IF EXISTS "Users can view their own orders" ON orders;
DROP POLICY IF EXISTS "Orders are viewable by the buyer" ON orders;

-- Create a new, simpler policy without recursion issues
CREATE POLICY "Orders are viewable by the buyer" ON orders
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    wallet_address = auth.uid()::text
  );

-- Create policy for admin access (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'orders' AND policyname = 'Admins can access all orders'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can access all orders" ON orders FOR ALL USING (is_admin())';
  END IF;
END
$$;

COMMIT; 