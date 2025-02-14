/*
  # Orders System Implementation

  1. New Tables
    - `orders` table for tracking customer purchases
      - `id` (uuid, primary key)
      - `product_id` (uuid, references products)
      - `variants` (jsonb array of selected options)
      - `shipping_info` (jsonb with address and contact details)
      - `transaction_id` (text, Solana transaction signature)
      - `transaction_status` (text enum: pending/confirmed/failed)
      - `wallet_address` (text, buyer's wallet)
      - `status` (text enum: pending/confirmed/shipped/delivered/cancelled)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS
    - Add policies for buyers and merchants
    - Add validation functions for JSON data

  3. Indexes
    - Add indexes for common query patterns
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

-- Create validation functions
CREATE OR REPLACE FUNCTION validate_shipping_info(info jsonb)
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

CREATE OR REPLACE FUNCTION validate_variants(vars jsonb)
RETURNS boolean AS $$
BEGIN
  RETURN (
    vars IS NULL OR
    jsonb_typeof(vars) = 'array'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add constraints
ALTER TABLE orders
ADD CONSTRAINT valid_shipping_info
  CHECK (validate_shipping_info(shipping_info));

ALTER TABLE orders
ADD CONSTRAINT valid_variants
  CHECK (validate_variants(variants));

-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Buyers can view their own orders"
  ON orders FOR SELECT
  TO authenticated
  USING (wallet_address = auth.jwt()->>'wallet_address');

CREATE POLICY "Merchants can view their products' orders"
  ON orders FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM products p
    JOIN collections c ON c.id = p.collection_id
    WHERE p.id = orders.product_id
    AND c.user_id = auth.uid()
  ));

CREATE POLICY "Merchants can update their orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM products p
    JOIN collections c ON c.id = p.collection_id
    WHERE p.id = orders.product_id
    AND c.user_id = auth.uid()
  ));

CREATE POLICY "Anyone can create orders"
  ON orders FOR INSERT
  WITH CHECK (true);

-- Create helper function for updating transaction status
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