-- Drop existing functions if they exist
DO $$ BEGIN
  DROP FUNCTION IF EXISTS log_transaction(text, numeric, text, uuid, text);
  DROP FUNCTION IF EXISTS update_transaction_status(text, text, text);
  DROP FUNCTION IF EXISTS recover_failed_order(text, jsonb, jsonb);
  DROP FUNCTION IF EXISTS get_failed_transactions(int, int);
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Drop existing policies if they exist
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view their own transactions" ON transaction_logs;
  DROP POLICY IF EXISTS "Merchants can view transactions for their products" ON transaction_logs;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create function to log transaction
CREATE OR REPLACE FUNCTION log_transaction(
  p_signature text,
  p_amount numeric,
  p_buyer_address text,
  p_product_id uuid,
  p_status text DEFAULT 'pending'
)
RETURNS uuid AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO transaction_logs (
    signature,
    amount,
    buyer_address,
    product_id,
    status
  )
  VALUES (
    p_signature,
    p_amount,
    p_buyer_address,
    p_product_id,
    p_status
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update transaction status
CREATE OR REPLACE FUNCTION update_transaction_status(
  p_signature text,
  p_status text,
  p_error_message text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE transaction_logs
  SET 
    status = p_status,
    error_message = CASE 
      WHEN p_status = 'failed' THEN p_error_message 
      ELSE NULL 
    END,
    retry_count = CASE 
      WHEN p_status = 'failed' THEN retry_count + 1 
      ELSE retry_count 
    END,
    updated_at = now()
  WHERE signature = p_signature;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to recover failed order
CREATE OR REPLACE FUNCTION recover_failed_order(
  p_signature text,
  p_shipping_info jsonb,
  p_variants jsonb DEFAULT '[]'
)
RETURNS uuid AS $$
DECLARE
  v_order_id uuid;
  v_tx_log transaction_logs;
BEGIN
  -- Get transaction log
  SELECT * INTO v_tx_log
  FROM transaction_logs
  WHERE signature = p_signature
  AND status = 'confirmed'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found or not confirmed';
  END IF;

  -- Verify order doesn't already exist
  IF EXISTS (
    SELECT 1 FROM orders WHERE transaction_id = p_signature
  ) THEN
    RAISE EXCEPTION 'Order already exists for this transaction';
  END IF;

  -- Create the order
  INSERT INTO orders (
    product_id,
    variants,
    shipping_info,
    transaction_id,
    transaction_status,
    wallet_address,
    status
  )
  VALUES (
    v_tx_log.product_id,
    p_variants,
    p_shipping_info,
    p_signature,
    'confirmed',
    v_tx_log.buyer_address,
    'confirmed'
  )
  RETURNING id INTO v_order_id;

  -- Update transaction log
  UPDATE transaction_logs
  SET 
    status = 'order_created',
    order_id = v_order_id,
    updated_at = now()
  WHERE id = v_tx_log.id;

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get failed transactions
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

-- Create RLS policies
CREATE POLICY "Users can view their own transactions"
  ON transaction_logs FOR SELECT
  TO authenticated
  USING (buyer_address = auth.jwt()->>'wallet_address');

CREATE POLICY "Merchants can view transactions for their products"
  ON transaction_logs FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM products p
    JOIN collections c ON c.id = p.collection_id
    WHERE p.id = transaction_logs.product_id
    AND c.user_id = auth.uid()
  ));