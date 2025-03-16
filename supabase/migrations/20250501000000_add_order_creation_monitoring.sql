-- Start transaction
BEGIN;

-- Add order_creation_attempted column to transaction_logs if it doesn't exist
ALTER TABLE transaction_logs
ADD COLUMN IF NOT EXISTS order_creation_attempted boolean DEFAULT false;

-- Add order_creation_error column to transaction_logs if it doesn't exist
ALTER TABLE transaction_logs
ADD COLUMN IF NOT EXISTS order_creation_error text;

-- Create function to log order creation attempt
CREATE OR REPLACE FUNCTION log_order_creation_attempt(
  p_signature text
)
RETURNS void AS $$
BEGIN
  UPDATE transaction_logs
  SET 
    order_creation_attempted = true,
    updated_at = now()
  WHERE signature = p_signature;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to log order creation error
CREATE OR REPLACE FUNCTION log_order_creation_error(
  p_signature text,
  p_error_message text
)
RETURNS void AS $$
BEGIN
  UPDATE transaction_logs
  SET 
    status = 'order_failed',
    order_creation_attempted = true,
    order_creation_error = p_error_message,
    updated_at = now()
  WHERE signature = p_signature;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update transaction with amount
CREATE OR REPLACE FUNCTION update_transaction_with_amount(
  p_signature text,
  p_status text,
  p_amount numeric
)
RETURNS void AS $$
BEGIN
  UPDATE transaction_logs
  SET 
    status = p_status,
    amount = p_amount,
    updated_at = now()
  WHERE signature = p_signature;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get payments without orders
CREATE OR REPLACE FUNCTION get_payments_without_orders(
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  signature text,
  amount numeric,
  buyer_address text,
  product_name text,
  product_sku text,
  status text,
  error_message text,
  order_creation_error text,
  created_at timestamptz,
  updated_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.signature,
    t.amount,
    t.buyer_address,
    p.name as product_name,
    p.sku as product_sku,
    t.status,
    t.error_message,
    t.order_creation_error,
    t.created_at,
    t.updated_at
  FROM transaction_logs t
  JOIN products p ON p.id = t.product_id
  JOIN collections c ON c.id = p.collection_id
  WHERE 
    -- Confirmed payments without associated orders
    (t.status = 'confirmed' AND NOT EXISTS (
      SELECT 1 FROM orders o WHERE o.transaction_signature = t.signature
    ))
    -- Or explicitly marked as order_failed
    OR t.status = 'order_failed'
    -- Only show transactions for the current user's collections
    AND c.user_id = auth.uid()
  ORDER BY t.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the get_failed_transactions function to include order_failed status
CREATE OR REPLACE FUNCTION get_failed_transactions(
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  signature text,
  amount numeric,
  buyer_address text,
  product_name text,
  product_sku text,
  status text,
  error_message text,
  order_creation_error text,
  retry_count integer,
  created_at timestamptz,
  updated_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.signature,
    t.amount,
    t.buyer_address,
    p.name as product_name,
    p.sku as product_sku,
    t.status,
    t.error_message,
    t.order_creation_error,
    t.retry_count,
    t.created_at,
    t.updated_at
  FROM transaction_logs t
  JOIN products p ON p.id = t.product_id
  JOIN collections c ON c.id = p.collection_id
  WHERE (
    t.status IN ('failed', 'order_failed')
    AND c.user_id = auth.uid()
  )
  ORDER BY t.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT; 