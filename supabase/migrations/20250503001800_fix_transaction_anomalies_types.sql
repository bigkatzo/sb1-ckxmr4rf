-- Start transaction
BEGIN;

-- Drop existing function
DROP FUNCTION IF EXISTS get_transaction_anomalies(int, int);

-- Create updated function with correct types
CREATE OR REPLACE FUNCTION get_transaction_anomalies(
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
) RETURNS TABLE (
  id uuid,
  type transaction_anomaly_type,
  order_id uuid,
  order_number text,
  order_status order_status_enum,  -- Changed from text to order_status_enum
  transaction_signature text,
  transaction_status jsonb,
  amount_sol numeric,
  expected_amount_sol numeric,
  buyer_address text,
  product_name text,
  product_sku text,
  error_message text,
  retry_count int,
  created_at timestamptz,
  updated_at timestamptz
) SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  -- Failed payments (existing transactions with errors)
  SELECT
    t.id::uuid,
    'failed_payment'::transaction_anomaly_type AS type,
    o.id AS order_id,
    o.order_number,
    o.status::order_status_enum AS order_status,  -- Cast to enum
    t.signature AS transaction_signature,
    jsonb_build_object('error', t.error_message) AS transaction_status,
    t.amount AS amount_sol,
    o.amount_sol AS expected_amount_sol,
    t.buyer_address,
    p.name AS product_name,
    p.sku AS product_sku,
    t.error_message,
    t.retry_count,
    t.created_at,
    t.updated_at
  FROM transaction_logs t
  LEFT JOIN orders o ON o.transaction_signature = t.signature
  LEFT JOIN products p ON o.product_id = p.id
  WHERE t.error_message IS NOT NULL
    AND t.error_message != 'Transaction rejected by user'
  
  UNION ALL
  
  -- Recent orders in pending_payment without a transaction (failed/rejected)
  SELECT
    o.id::uuid,
    'rejected_payment'::transaction_anomaly_type AS type,
    o.id AS order_id,
    o.order_number,
    o.status::order_status_enum AS order_status,  -- Cast to enum
    o.transaction_signature,
    NULL AS transaction_status,
    NULL AS amount_sol,
    o.amount_sol AS expected_amount_sol,
    o.wallet_address AS buyer_address,
    p.name AS product_name,
    p.sku AS product_sku,
    'Payment was rejected or failed' AS error_message,
    0 AS retry_count,
    o.created_at,
    o.updated_at
  FROM orders o
  LEFT JOIN products p ON o.product_id = p.id
  WHERE o.status = 'pending_payment'
    AND o.transaction_signature IS NULL
    AND o.created_at > now() - interval '24 hours' -- Only exclude very old orders
  
  UNION ALL
  
  -- Rejected payments (transactions rejected by user)
  SELECT
    COALESCE(o.id, t.id)::uuid,
    'rejected_payment'::transaction_anomaly_type AS type,
    o.id AS order_id,
    o.order_number,
    o.status::order_status_enum AS order_status,  -- Cast to enum
    t.signature AS transaction_signature,
    jsonb_build_object('error', t.error_message) AS transaction_status,
    t.amount AS amount_sol,
    o.amount_sol AS expected_amount_sol,
    COALESCE(t.buyer_address, o.wallet_address) AS buyer_address,
    p.name AS product_name,
    p.sku AS product_sku,
    'Transaction was rejected by the user' AS error_message,
    t.retry_count,
    COALESCE(t.created_at, o.created_at) AS created_at,
    COALESCE(t.updated_at, o.updated_at) AS updated_at
  FROM orders o
  LEFT JOIN transaction_logs t ON t.signature = o.transaction_signature
  LEFT JOIN products p ON o.product_id = p.id
  WHERE o.status = 'pending_payment'
    AND t.error_message = 'Transaction rejected by user'
  
  UNION ALL
  
  -- Orphaned transactions (successful transactions without orders)
  SELECT
    t.id::uuid,
    'orphaned_transaction'::transaction_anomaly_type AS type,
    NULL AS order_id,
    NULL AS order_number,
    NULL::order_status_enum AS order_status,  -- Cast NULL to enum
    t.signature AS transaction_signature,
    jsonb_build_object('success', true) AS transaction_status,
    t.amount AS amount_sol,
    NULL AS expected_amount_sol,
    t.buyer_address,
    NULL AS product_name,
    NULL AS product_sku,
    'Transaction exists but no order was created' AS error_message,
    t.retry_count,
    t.created_at,
    t.updated_at
  FROM transaction_logs t
  LEFT JOIN orders o ON o.transaction_signature = t.signature
  WHERE o.id IS NULL
    AND t.status = 'confirmed'
    AND t.error_message IS NULL
  
  UNION ALL
  
  -- Abandoned orders (draft/pending orders that are old)
  SELECT
    o.id::uuid,
    'abandoned_order'::transaction_anomaly_type AS type,
    o.id AS order_id,
    o.order_number,
    o.status::order_status_enum AS order_status,  -- Cast to enum
    o.transaction_signature,
    NULL AS transaction_status,
    NULL AS amount_sol,
    o.amount_sol AS expected_amount_sol,
    o.wallet_address AS buyer_address,
    p.name AS product_name,
    p.sku AS product_sku,
    CASE 
      WHEN o.status = 'draft' THEN 'Order created but payment not initiated'
      WHEN o.status = 'pending_payment' THEN 'Payment initiated but not completed'
    END AS error_message,
    0 AS retry_count,
    o.created_at,
    o.updated_at
  FROM orders o
  LEFT JOIN products p ON o.product_id = p.id
  WHERE o.status IN ('draft', 'pending_payment')
    AND o.created_at < now() - interval '24 hours'
  
  UNION ALL
  
  -- Orders in pending_payment with transaction
  SELECT
    o.id::uuid,
    'pending_timeout'::transaction_anomaly_type AS type,
    o.id AS order_id,
    o.order_number,
    o.status::order_status_enum AS order_status,  -- Cast to enum
    o.transaction_signature,
    NULL AS transaction_status,
    NULL AS amount_sol,
    o.amount_sol AS expected_amount_sol,
    o.wallet_address AS buyer_address,
    p.name AS product_name,
    p.sku AS product_sku,
    'Payment initiated but not completed' AS error_message,
    0 AS retry_count,
    o.created_at,
    o.updated_at
  FROM orders o
  LEFT JOIN products p ON o.product_id = p.id
  WHERE o.status = 'pending_payment'
    AND o.transaction_signature IS NOT NULL
    AND o.created_at > now() - interval '24 hours'
    AND NOT EXISTS (
      SELECT 1 FROM transaction_logs t
      WHERE t.signature = o.transaction_signature
      AND t.error_message = 'Transaction rejected by user'
    )
  
  UNION ALL
  
  -- Multiple transactions for same order
  SELECT
    o.id::uuid,
    'multiple_transactions'::transaction_anomaly_type AS type,
    o.id AS order_id,
    o.order_number,
    o.status::order_status_enum AS order_status,  -- Cast to enum
    o.transaction_signature,
    NULL AS transaction_status,
    NULL AS amount_sol,
    o.amount_sol AS expected_amount_sol,
    o.wallet_address AS buyer_address,
    p.name AS product_name,
    p.sku AS product_sku,
    'Multiple transactions found for this order' AS error_message,
    0 AS retry_count,
    o.created_at,
    o.updated_at
  FROM orders o
  LEFT JOIN products p ON o.product_id = p.id
  WHERE EXISTS (
    SELECT 1 FROM transaction_logs t
    WHERE t.buyer_address = o.wallet_address
    AND t.amount = o.amount_sol
    AND t.created_at BETWEEN o.created_at - interval '1 hour' AND o.created_at + interval '1 hour'
    GROUP BY t.buyer_address, t.amount
    HAVING count(*) > 1
  )
  
  UNION ALL
  
  -- Mismatched amounts
  SELECT
    o.id::uuid,
    'mismatched_amount'::transaction_anomaly_type AS type,
    o.id AS order_id,
    o.order_number,
    o.status::order_status_enum AS order_status,  -- Cast to enum
    o.transaction_signature,
    jsonb_build_object('success', true) AS transaction_status,
    t.amount AS amount_sol,
    o.amount_sol AS expected_amount_sol,
    o.wallet_address AS buyer_address,
    p.name AS product_name,
    p.sku AS product_sku,
    format('Amount mismatch: expected %s SOL, got %s SOL', o.amount_sol, t.amount) AS error_message,
    0 AS retry_count,
    o.created_at,
    o.updated_at
  FROM orders o
  JOIN transaction_logs t ON t.signature = o.transaction_signature
  LEFT JOIN products p ON o.product_id = p.id
  WHERE t.amount != o.amount_sol
  
  ORDER BY created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Grant access to the function
GRANT EXECUTE ON FUNCTION get_transaction_anomalies(int, int) TO authenticated;

COMMIT; 