-- Start transaction
BEGIN;

-- Drop all versions of the old confirm_order_payment function
DROP FUNCTION IF EXISTS confirm_order_payment(TEXT, TEXT);
DROP FUNCTION IF EXISTS confirm_order_payment(TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS confirm_order_payment_with_details(TEXT, TEXT, JSONB);

-- Drop old function that used transaction_id instead of transaction_signature
DROP FUNCTION IF EXISTS confirm_order_payment(uuid, text);

-- Drop old transaction_id column from orders table
ALTER TABLE orders DROP COLUMN IF EXISTS transaction_id;

-- Drop any indexes that might reference the old column
DROP INDEX IF EXISTS idx_orders_transaction_id;

COMMIT; 