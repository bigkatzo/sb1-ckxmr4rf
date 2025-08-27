-- Fix RLS policies for design page access
-- This migration ensures that users authenticated via wallet can access design files
BEGIN;

-- Create a function to check if user has access to design files
CREATE OR REPLACE FUNCTION check_design_access(product_id uuid)
RETURNS boolean AS $$
DECLARE
  user_id uuid;
  wallet_address text;
  product_wallet text;
BEGIN
  -- Get the current user ID from JWT
  user_id := auth.uid();
  
  -- If no user ID, check wallet headers
  IF user_id IS NULL THEN
    -- Try to get wallet from headers
    BEGIN
      wallet_address := current_setting('request.headers.x-wallet-address', true);
    EXCEPTION WHEN OTHERS THEN
      wallet_address := NULL;
    END;
    
    -- If we have a wallet address, check if it matches the product's wallet
    IF wallet_address IS NOT NULL THEN
      SELECT o.wallet_address INTO product_wallet
      FROM orders o
      WHERE o.product_id = check_design_access.product_id
      LIMIT 1;
      
      RETURN wallet_address = product_wallet;
    END IF;
    
    RETURN false;
  END IF;
  
  -- If we have a user ID, check if they have ordered this product
  RETURN EXISTS (
    SELECT 1 
    FROM orders o
    WHERE o.product_id = check_design_access.product_id
    AND (
      -- Check if user has ordered this product
      o.user_id = user_id
      OR
      -- Check if user's wallet address matches the order
      o.wallet_address = (
        SELECT raw_user_meta_data->>'wallet_address'
        FROM auth.users
        WHERE id = user_id
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_design_access(uuid) TO authenticated, anon;

-- Create a policy for products table to allow design access
DROP POLICY IF EXISTS products_design_access ON products;

CREATE POLICY products_design_access ON products
  FOR SELECT
  USING (
    -- Allow if product is visible
    visible = true
    OR
    -- Allow if user has design access
    check_design_access(id)
  );

-- Create a policy for design files access
DROP POLICY IF EXISTS design_files_access ON products;

CREATE POLICY design_files_access ON products
  FOR SELECT
  USING (
    -- Allow if product is visible and has design files
    (visible = true AND design_files IS NOT NULL AND jsonb_array_length(design_files) > 0)
    OR
    -- Allow if user has design access
    check_design_access(id)
  );

-- Update the user_orders view to work with the new authentication
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
  -- Use the new authentication function
  check_design_access(o.product_id)
  OR
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

-- Create a function to sync wallet address with user metadata
CREATE OR REPLACE FUNCTION sync_wallet_metadata()
RETURNS trigger AS $$
BEGIN
  -- Update user metadata when wallet address changes
  IF NEW.raw_user_meta_data->>'wallet_address' != OLD.raw_user_meta_data->>'wallet_address' THEN
    -- Update any related tables that need wallet address sync
    UPDATE orders 
    SET wallet_address = NEW.raw_user_meta_data->>'wallet_address'
    WHERE user_id = NEW.id 
    AND wallet_address IS NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to sync wallet metadata
DROP TRIGGER IF EXISTS sync_wallet_metadata_trigger ON auth.users;

CREATE TRIGGER sync_wallet_metadata_trigger
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION sync_wallet_metadata();

COMMIT;
