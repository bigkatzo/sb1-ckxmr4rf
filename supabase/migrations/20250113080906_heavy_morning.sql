-- Drop existing table
DROP TABLE IF EXISTS orders;

-- Create orders table with proper schema
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE RESTRICT NOT NULL,
  variants jsonb DEFAULT '[]'::jsonb,
  shipping_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  transaction_id text NOT NULL,
  transaction_status text NOT NULL DEFAULT 'pending' 
    CHECK (transaction_status IN ('pending', 'confirmed', 'failed')),
  wallet_address text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_orders_product_id ON orders(product_id);
CREATE INDEX idx_orders_wallet_address ON orders(wallet_address);
CREATE INDEX idx_orders_transaction_id ON orders(transaction_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Create simplified RLS policies
CREATE POLICY "Buyers can view their own orders"
  ON orders FOR SELECT
  TO authenticated
  USING (wallet_address = current_setting('request.jwt.claims')::json->>'wallet_address');

CREATE POLICY "Merchants can view orders for their products"
  ON orders FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM products p
    JOIN collections c ON c.id = p.collection_id
    WHERE p.id = orders.product_id
    AND c.user_id = auth.uid()
  ));

CREATE POLICY "Merchants can update orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM products p
    JOIN collections c ON c.id = p.collection_id
    WHERE p.id = orders.product_id
    AND c.user_id = auth.uid()
  ));

CREATE POLICY "Authenticated users can create orders"
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
  SET transaction_status = p_status
  WHERE transaction_id = p_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;