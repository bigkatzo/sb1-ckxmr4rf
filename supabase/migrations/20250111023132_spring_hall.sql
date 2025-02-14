/*
  # Add Transaction Support

  1. New Tables
    - `transactions`
      - `id` (uuid, primary key) 
      - `signature` (text)
      - `status` (text)
      - `amount` (numeric)
      - `buyer_address` (text)
      - `product_id` (uuid)
      - `created_at` (timestamptz)
      - `confirmed_at` (timestamptz)

  2. Functions
    - `create_transaction()`: Creates new transaction record
    - `confirm_transaction()`: Updates transaction status
*/

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signature text UNIQUE,
  status text NOT NULL CHECK (status IN ('pending', 'confirmed', 'failed')),
  amount numeric(20, 9) NOT NULL CHECK (amount > 0),
  buyer_address text NOT NULL,
  product_id uuid REFERENCES products(id) ON DELETE RESTRICT,
  created_at timestamptz DEFAULT now(),
  confirmed_at timestamptz,
  error_message text
);

-- Enable RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Public can view their own transactions"
  ON transactions FOR SELECT
  USING (buyer_address = auth.jwt()->>'wallet_address');

CREATE POLICY "Anyone can create transactions"
  ON transactions FOR INSERT
  WITH CHECK (true);

-- Create function to create transaction
CREATE OR REPLACE FUNCTION create_transaction(
  p_signature text,
  p_amount numeric,
  p_buyer_address text,
  p_product_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_transaction_id uuid;
BEGIN
  INSERT INTO transactions (
    signature,
    status,
    amount,
    buyer_address,
    product_id
  )
  VALUES (
    p_signature,
    'pending',
    p_amount,
    p_buyer_address,
    p_product_id
  )
  RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$;

-- Create function to confirm transaction
CREATE OR REPLACE FUNCTION confirm_transaction(
  p_signature text,
  p_status text,
  p_error_message text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE transactions
  SET 
    status = p_status,
    confirmed_at = CASE WHEN p_status = 'confirmed' THEN now() ELSE NULL END,
    error_message = p_error_message
  WHERE signature = p_signature;

  RETURN FOUND;
END;
$$;