-- Drop existing policies if they exist
DO $$ BEGIN
  DROP POLICY IF EXISTS "orders_select_buyer" ON orders;
  DROP POLICY IF EXISTS "orders_select_merchant" ON orders;
  DROP POLICY IF EXISTS "orders_update_merchant" ON orders;
  DROP POLICY IF EXISTS "orders_insert_authenticated" ON orders;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create new RLS policies with proper wallet address check
CREATE POLICY "orders_select_buyer"
  ON orders FOR SELECT
  TO authenticated
  USING (wallet_address = current_setting('request.jwt.claims', true)::jsonb->>'wallet_address');

CREATE POLICY "orders_select_merchant"
  ON orders FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM products p
    JOIN collections c ON c.id = p.collection_id
    WHERE p.id = orders.product_id
    AND c.user_id = auth.uid()
  ));

CREATE POLICY "orders_update_merchant"
  ON orders FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM products p
    JOIN collections c ON c.id = p.collection_id
    WHERE p.id = orders.product_id
    AND c.user_id = auth.uid()
  ));

CREATE POLICY "orders_insert_authenticated"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (wallet_address = current_setting('request.jwt.claims', true)::jsonb->>'wallet_address');