-- Add minimum_order_quantity column to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS minimum_order_quantity integer DEFAULT 0 CHECK (minimum_order_quantity >= 0);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_products_min_order_qty
ON products(minimum_order_quantity);