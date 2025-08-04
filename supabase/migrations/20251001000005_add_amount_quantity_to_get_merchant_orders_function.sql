-- Migration to add amount and quantity fields to get_merchant_orders function
-- This ensures the function returns the new fields that were added to the orders table

BEGIN;

-- Drop existing function
DROP FUNCTION IF EXISTS get_merchant_orders(int, int);

-- Create updated function with amount and quantity fields
CREATE OR REPLACE FUNCTION get_merchant_orders(
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  order_number text,
  product_name text,
  product_sku text,
  product_price numeric,
  product_image text,
  collection_name text,
  category_name text,
  variants jsonb,
  shipping_info jsonb,
  transaction_id text,
  wallet_address text,
  status text,
  amount_sol numeric,
  amount numeric,
  quantity int,
  created_at timestamptz,
  updated_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.order_number,
    p.name as product_name,
    p.sku as product_sku,
    p.price as product_price,
    CASE 
      WHEN p.images IS NOT NULL AND jsonb_array_length(p.images::jsonb) > 0 
      THEN p.images[0]
      ELSE NULL 
    END as product_image,
    c.name as collection_name,
    cat.name as category_name,
    o.variants,
    o.shipping_info,
    o.transaction_id,
    o.wallet_address,
    o.status,
    o.amount_sol,
    o.amount,
    o.quantity,
    o.created_at,
    o.updated_at
  FROM orders o
  JOIN products p ON p.id = o.product_id
  JOIN collections c ON c.id = p.collection_id
  LEFT JOIN categories cat ON cat.id = p.category_id
  WHERE c.user_id = auth.uid()
  ORDER BY o.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT; 