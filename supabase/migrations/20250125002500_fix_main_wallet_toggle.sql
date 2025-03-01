-- Drop existing function and constraints
DROP FUNCTION IF EXISTS set_main_wallet(uuid);
DROP INDEX IF EXISTS idx_merchant_wallets_main;
ALTER TABLE merchant_wallets DROP CONSTRAINT IF EXISTS merchant_wallets_main_key;
ALTER TABLE merchant_wallets DROP CONSTRAINT IF EXISTS merchant_wallets_main_unique;

-- Create constraints for main wallet
-- Ensure only active wallets can be main
ALTER TABLE merchant_wallets ADD CONSTRAINT merchant_wallets_main_active_check 
CHECK (NOT is_main OR (is_main AND is_active));

-- Ensure only one wallet can be main
CREATE UNIQUE INDEX merchant_wallets_main_unique 
ON merchant_wallets ((true))
WHERE is_main = true;

-- Create improved set_main_wallet function
CREATE OR REPLACE FUNCTION set_main_wallet(p_wallet_id uuid)
RETURNS void AS $$
DECLARE
  v_current_main_id uuid;
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

  -- Get current main wallet ID
  SELECT id INTO v_current_main_id
  FROM merchant_wallets
  WHERE is_main = true;

  -- If we're trying to set the same wallet as main, do nothing
  IF v_current_main_id = p_wallet_id THEN
    RETURN;
  END IF;

  -- Perform updates in a transaction
  BEGIN
    -- First unset the current main wallet
    IF v_current_main_id IS NOT NULL THEN
      UPDATE merchant_wallets
      SET is_main = false
      WHERE id = v_current_main_id;
    END IF;

    -- Then set the new main wallet
    UPDATE merchant_wallets
    SET is_main = true
    WHERE id = p_wallet_id;

    -- Verify we have exactly one main wallet
    IF (SELECT COUNT(*) FROM merchant_wallets WHERE is_main = true) != 1 THEN
      RAISE EXCEPTION 'System must have exactly one main wallet';
    END IF;
  EXCEPTION
    WHEN others THEN
      RAISE EXCEPTION 'Failed to set main wallet: %', SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION set_main_wallet(uuid) TO authenticated;

-- Add documentation
COMMENT ON FUNCTION set_main_wallet(uuid) IS 'Sets the specified wallet as the main wallet (admin only). Only active wallets can be set as main.'; 