-- Drop existing function and constraints
DROP FUNCTION IF EXISTS set_main_wallet(uuid);
DROP INDEX IF EXISTS idx_merchant_wallets_main;
ALTER TABLE merchant_wallets DROP CONSTRAINT IF EXISTS merchant_wallets_main_key;

-- Create partial unique constraint for main wallet
ALTER TABLE merchant_wallets ADD CONSTRAINT merchant_wallets_main_unique 
CHECK (NOT is_main OR (is_main AND is_active));

-- Create improved set_main_wallet function
CREATE OR REPLACE FUNCTION set_main_wallet(p_wallet_id uuid)
RETURNS void AS $$
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

  -- Update all wallets in a single atomic operation
  UPDATE merchant_wallets
  SET is_main = CASE 
    WHEN id = p_wallet_id THEN true
    ELSE false
  END;

  -- Verify we have exactly one main wallet
  IF (SELECT COUNT(*) FROM merchant_wallets WHERE is_main = true) != 1 THEN
    RAISE EXCEPTION 'System must have exactly one main wallet';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION set_main_wallet(uuid) TO authenticated;

-- Add documentation
COMMENT ON FUNCTION set_main_wallet(uuid) IS 'Sets the specified wallet as the main wallet (admin only). Only active wallets can be set as main.'; 