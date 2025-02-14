-- Update minimum_order_quantity column default to 50
ALTER TABLE products 
ALTER COLUMN minimum_order_quantity SET DEFAULT 50;

-- Update existing products to have minimum_order_quantity of 50 if it's 0
UPDATE products 
SET minimum_order_quantity = 50 
WHERE minimum_order_quantity = 0;