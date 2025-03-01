-- Drop existing policies if they exist
DO $$ BEGIN
  DROP POLICY IF EXISTS "orders_select_buyer" ON orders;
  DROP POLICY IF EXISTS "orders_select_merchant" ON orders;
  DROP POLICY IF EXISTS "orders_update_merchant" ON orders;
  DROP POLICY IF EXISTS "orders_insert_authenticated" ON orders;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create orders table if it doesn't exist
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE RESTRICT NOT NULL,
  variants jsonb DEFAULT '[]'::jsonb,
  shipping_info jsonb NOT NULL,
  transaction_id text NOT NULL,
  transaction_status text NOT NULL CHECK (transaction_status IN ('pending', 'confirmed', 'failed')),
  wallet_address text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_wallet_address ON orders(wallet_address);
CREATE INDEX IF NOT EXISTS idx_orders_transaction_id ON orders(transaction_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Create RLS policies with unique names
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
  WITH CHECK (true);

-- Create function to update transaction status
CREATE OR REPLACE FUNCTION update_order_transaction_status(
  p_transaction_id text,
  p_status text
)
RETURNS void AS $$
BEGIN
  UPDATE orders
  SET 
    transaction_status = p_status,
    updated_at = now()
  WHERE transaction_id = p_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update order status
CREATE OR REPLACE FUNCTION update_order_status(
  p_order_id uuid,
  p_status text
)
RETURNS void AS $$
BEGIN
  -- Verify merchant has access to this order
  IF NOT EXISTS (
    SELECT 1 FROM orders o
    JOIN products p ON p.id = o.product_id
    JOIN collections c ON c.id = p.collection_id
    WHERE o.id = p_order_id
    AND c.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Update order status
  UPDATE orders
  SET 
    status = p_status,
    updated_at = now()
  WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get merchant orders
CREATE OR REPLACE FUNCTION get_merchant_orders(
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  product_name text,
  product_sku text,
  variants jsonb,
  shipping_info jsonb,
  transaction_id text,
  transaction_status text,
  wallet_address text,
  status text,
  created_at timestamptz,
  updated_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    p.name as product_name,
    p.sku as product_sku,
    o.variants,
    o.shipping_info,
    o.transaction_id,
    o.transaction_status,
    o.wallet_address,
    o.status,
    o.created_at,
    o.updated_at
  FROM orders o
  JOIN products p ON p.id = o.product_id
  JOIN collections c ON c.id = p.collection_id
  WHERE c.user_id = auth.uid()
  ORDER BY o.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;