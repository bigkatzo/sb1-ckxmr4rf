-- Add batch_order_id to orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS batch_order_id UUID;

-- Add item position and total count for batch orders
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS item_index INTEGER,
ADD COLUMN IF NOT EXISTS total_items_in_batch INTEGER;

-- Create index for faster queries on batch orders
CREATE INDEX IF NOT EXISTS idx_orders_batch_order_id ON orders(batch_order_id);

-- Update RLS policies to allow batch order operations
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Policy for reading orders based on wallet address or batch order ID
DROP POLICY IF EXISTS "Users can view their own orders or orders in their batch" ON orders;
CREATE POLICY "Users can view their own orders or orders in their batch" 
ON orders FOR SELECT 
USING (
    wallet_address = auth.jwt() ->> 'wallet_address'
    OR batch_order_id IN (
        SELECT batch_order_id FROM orders 
        WHERE wallet_address = auth.jwt() ->> 'wallet_address'
        AND batch_order_id IS NOT NULL
    )
);

-- Create function to check if all orders in a batch are confirmed
CREATE OR REPLACE FUNCTION check_batch_order_status(batch_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    all_confirmed BOOLEAN;
BEGIN
    SELECT CASE 
        WHEN COUNT(*) = 0 THEN FALSE
        WHEN COUNT(*) = SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) THEN TRUE
        ELSE FALSE
    END INTO all_confirmed
    FROM orders
    WHERE batch_order_id = batch_id;
    
    RETURN all_confirmed;
END;
$$ LANGUAGE plpgsql; 