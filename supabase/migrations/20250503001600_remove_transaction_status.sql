-- Start transaction
BEGIN;

-- Drop transaction_status column and its constraint
ALTER TABLE orders 
DROP CONSTRAINT IF EXISTS orders_transaction_status_check,
DROP COLUMN IF EXISTS transaction_status;

-- Drop any functions that reference transaction_status
DROP FUNCTION IF EXISTS update_order_transaction_status(text, text);
DROP FUNCTION IF EXISTS update_order_transaction_status(text, text, jsonb);

COMMIT; 