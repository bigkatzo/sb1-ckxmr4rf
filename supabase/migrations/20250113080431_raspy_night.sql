/*
  # Update Orders Table Schema

  1. Changes
    - Drop existing orders table if exists
    - Create new orders table with proper schema
    - Add constraints and indexes
    - Set up RLS policies
    - Add helper functions

  2. Security
    - Enable RLS
    - Add policies for buyers and merchants
*/

-- Drop existing table if it exists
DROP TABLE IF EXISTS orders;

-- Create orders table
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE RESTRICT NOT NULL,
  variants jsonb DEFAULT '[]'::jsonb,
  shipping_info jsonb NOT NULL,
  transaction_id text NOT NULL,
  transaction_status text NOT NULL CHECK (transaction_status IN ('pending', 'confirmed', 'failed')),
  wallet_address text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX idx_orders_product_id ON orders(product_id);
CREATE INDEX idx_orders_transaction_id ON orders(transaction_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- Create functions for JSON validation
CREATE OR REPLACE FUNCTION is_valid_shipping_info(info jsonb)
RETURNS boolean AS $$
BEGIN
  RETURN (
    jsonb_typeof(info) = 'object' AND
    info ? 'address' AND
    info ? 'contactMethod' AND
    info ? 'contactValue' AND
    jsonb_typeof(info->'address') = 'string' AND
    jsonb_typeof(info->'contactMethod') = 'string' AND
    jsonb_typeof(info->'contactValue') = 'string'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION is_valid_variants(vars jsonb)
RETURNS boolean AS $$
BEGIN
  RETURN (
    vars IS NULL OR
    jsonb_typeof(vars) = 'array'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add constraints using the validation functions
ALTER TABLE orders
ADD CONSTRAINT valid_shipping_info
  CHECK (is_valid_shipping_info(shipping_info));

ALTER TABLE orders
ADD CONSTRAINT valid_variants
  CHECK (is_valid_variants(variants));

-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Buyers can view their own orders"
  ON orders FOR SELECT
  USING (wallet_address = auth.jwt()->>'wallet_address');

CREATE POLICY "Merchants can view orders for their products"
  ON orders FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM products
    JOIN collections ON collections.id = products.collection_id
    WHERE products.id = orders.product_id
    AND collections.user_id = auth.uid()
  ));

CREATE POLICY "Merchants can update order status"
  ON orders FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM products
    JOIN collections ON collections.id = products.collection_id
    WHERE products.id = orders.product_id
    AND collections.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM products
    JOIN collections ON collections.id = products.collection_id
    WHERE products.id = orders.product_id
    AND collections.user_id = auth.uid()
  ));

CREATE POLICY "Anyone can create orders"
  ON orders FOR INSERT
  WITH CHECK (true);

-- Create helper functions
CREATE OR REPLACE FUNCTION update_transaction_status(
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