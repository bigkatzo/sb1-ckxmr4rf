-- Start transaction
BEGIN;

-- Add unique constraint on transaction_signature
-- This prevents duplicate orders for the same transaction while allowing nulls
CREATE UNIQUE INDEX orders_transaction_signature_unique 
ON orders (transaction_signature)
WHERE transaction_signature IS NOT NULL;

COMMIT; 