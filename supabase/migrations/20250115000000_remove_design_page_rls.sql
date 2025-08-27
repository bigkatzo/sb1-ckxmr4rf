-- Remove RLS restrictions for product design page access
-- This migration makes design pages accessible to all users without authentication
BEGIN;

-- Drop the design access policies that restrict access
DROP POLICY IF EXISTS products_design_access ON products;
DROP POLICY IF EXISTS design_files_access ON products;

-- Create a new policy that allows public access to all products for design pages
CREATE POLICY products_public_design_access ON products
  FOR SELECT
  USING (
    -- Allow access to all products regardless of authentication
    true
  );

-- Drop the check_design_access function since it's no longer needed
DROP FUNCTION IF EXISTS check_design_access(uuid);

-- Update the user_orders view to remove design access restrictions
CREATE OR REPLACE VIEW user_orders AS 
SELECT 
  o.id,
  o.order_number,
  o.product_id,
  o.collection_id,
  o.wallet_address,
  o.status,
  o.amount_sol,
  o.created_at,
  o.updated_at,
  o.transaction_signature,
  o.shipping_address,
  o.contact_info,
  o.variant_selections,
  o.product_snapshot,
  o.collection_snapshot,
  o.payment_metadata,
  o.product_name,
  o.product_sku,
  o.collection_name,
  o.category_name
FROM 
  orders o
WHERE 
  -- Allow access if user has ordered this product
  o.user_id = auth.uid()
  OR
  -- Allow access if wallet address matches
  o.wallet_address = (
    SELECT raw_user_meta_data->>'wallet_address'
    FROM auth.users
    WHERE id = auth.uid()
  );

-- Grant permissions on the view
GRANT SELECT ON user_orders TO authenticated, anon;

COMMIT;
