-- Drop existing function
DROP FUNCTION IF EXISTS set_main_wallet(uuid);

-- Create improved set_main_wallet function
CREATE OR REPLACE FUNCTION set_main_wallet(p_wallet_id uuid)
RETURNS void AS $$
DECLARE
  v_constraint_exists boolean;
BEGIN
  -- Verify caller is admin
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin can set main wallet';
  END IF;

  -- Check if wallet exists and is active
  IF NOT EXISTS (
    SELECT 1 FROM merchant_wallets
    WHERE id = p_wallet_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Cannot set inactive wallet as main';
  END IF;

  -- Check if constraint exists
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'idx_merchant_wallets_main'
  ) INTO v_constraint_exists;

  -- Drop the unique constraint if it exists
  IF v_constraint_exists THEN
    ALTER TABLE merchant_wallets DROP CONSTRAINT idx_merchant_wallets_main;
  END IF;

  -- First, unset all main wallets
  UPDATE merchant_wallets
  SET is_main = false
  WHERE is_main = true;

  -- Then set the new main wallet
  UPDATE merchant_wallets
  SET is_main = true
  WHERE id = p_wallet_id;

  -- Recreate the unique constraint
  ALTER TABLE merchant_wallets
  ADD CONSTRAINT idx_merchant_wallets_main
  UNIQUE (is_main)
  WHERE is_main = true;

  -- Verify we have a main wallet
  IF NOT EXISTS (SELECT 1 FROM merchant_wallets WHERE is_main = true) THEN
    RAISE EXCEPTION 'System must have a main wallet';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION set_main_wallet(uuid) TO authenticated;

-- Add documentation
COMMENT ON FUNCTION set_main_wallet(uuid) IS 'Sets the specified wallet as the main wallet (admin only). Only active wallets can be set as main.'; 