-- Drop all existing triggers and functions that are causing the issues
DROP TRIGGER IF EXISTS ensure_first_wallet_is_main_trigger ON merchant_wallets;
DROP TRIGGER IF EXISTS ensure_main_wallet_trigger ON merchant_wallets;
DROP FUNCTION IF EXISTS ensure_first_wallet_is_main() CASCADE;
DROP FUNCTION IF EXISTS ensure_main_wallet() CASCADE;
DROP FUNCTION IF EXISTS create_non_main_wallet(text, text) CASCADE;

-- Modify the unique constraint to allow multiple wallets with is_main=false
DROP INDEX IF EXISTS merchant_wallets_main_unique;
DROP INDEX IF EXISTS idx_merchant_wallets_main;

-- Create a proper unique constraint that only ensures one main wallet
CREATE UNIQUE INDEX merchant_wallets_single_main 
ON merchant_wallets (is_main)
WHERE is_main = true;

-- Set default value for is_main to false
ALTER TABLE merchant_wallets 
ALTER COLUMN is_main SET DEFAULT false;

-- Create a simpler function to create wallets
CREATE OR REPLACE FUNCTION create_wallet(
  p_address text,
  p_label text,
  p_is_main boolean DEFAULT false
)
RETURNS uuid AS $$
DECLARE
  v_wallet_id uuid;
  v_existing_main_count int;
BEGIN
  -- Only allow admin to create wallets
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin can create wallets';
  END IF;

  -- Validate address format
  IF NOT p_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' THEN
    RAISE EXCEPTION 'Invalid wallet address format';
  END IF;

  -- Check if trying to create as main
  IF p_is_main THEN
    -- Check if there's already a main wallet
    SELECT COUNT(*) INTO v_existing_main_count
    FROM merchant_wallets
    WHERE is_main = true;
    
    -- If there's already a main wallet, we need to unset it
    IF v_existing_main_count > 0 THEN
      UPDATE merchant_wallets
      SET is_main = false
      WHERE is_main = true;
    END IF;
  END IF;

  -- Insert the wallet
  INSERT INTO merchant_wallets (
    address,
    label,
    is_active,
    is_main
  )
  VALUES (
    p_address,
    p_label,
    true,
    p_is_main
  )
  RETURNING id INTO v_wallet_id;

  -- Check if we need to set one wallet as main (if no main wallet exists)
  IF NOT EXISTS (SELECT 1 FROM merchant_wallets WHERE is_main = true) THEN
    -- Set this wallet as main if it's the only one
    IF (SELECT COUNT(*) FROM merchant_wallets) = 1 THEN
      UPDATE merchant_wallets
      SET is_main = true
      WHERE id = v_wallet_id;
    ELSE
      -- Find the first active wallet and set it as main
      WITH first_wallet AS (
        SELECT id FROM merchant_wallets
        WHERE is_active = true
        ORDER BY created_at ASC
        LIMIT 1
      )
      UPDATE merchant_wallets
      SET is_main = true
      FROM first_wallet
      WHERE merchant_wallets.id = first_wallet.id;
    END IF;
  END IF;

  RETURN v_wallet_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION create_wallet(text, text, boolean) TO authenticated;

-- Add documentation
COMMENT ON FUNCTION create_wallet(text, text, boolean) IS 'Creates a new wallet with option to set as main. If creating as main, any existing main wallet will be unset.'; 