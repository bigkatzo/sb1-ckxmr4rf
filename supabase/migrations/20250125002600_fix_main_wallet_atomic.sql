-- Drop existing function and constraints
DROP FUNCTION IF EXISTS set_main_wallet(uuid);
DROP INDEX IF EXISTS idx_merchant_wallets_main;
DROP INDEX IF EXISTS merchant_wallets_main_unique;
ALTER TABLE merchant_wallets DROP CONSTRAINT IF EXISTS merchant_wallets_main_key;
ALTER TABLE merchant_wallets DROP CONSTRAINT IF EXISTS merchant_wallets_main_active_check;

-- Create improved set_main_wallet function with atomic update
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

  -- Perform atomic update using a CTE
  WITH updated_wallets AS (
    UPDATE merchant_wallets
    SET is_main = false
    WHERE is_main = true
    RETURNING id
  )
  UPDATE merchant_wallets
  SET is_main = true
  WHERE id = p_wallet_id
  AND (
    -- Either there was no main wallet before
    NOT EXISTS (SELECT 1 FROM updated_wallets)
    -- Or we successfully unset the previous main wallet
    OR EXISTS (SELECT 1 FROM updated_wallets)
  );

  -- Verify we have exactly one main wallet
  IF (SELECT COUNT(*) FROM merchant_wallets WHERE is_main = true) != 1 THEN
    RAISE EXCEPTION 'System must have exactly one main wallet';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create unique constraint for main wallet
CREATE UNIQUE INDEX merchant_wallets_main_unique 
ON merchant_wallets ((1))
WHERE is_main = true;

-- Create check constraint for active main wallet
ALTER TABLE merchant_wallets 
ADD CONSTRAINT merchant_wallets_main_active_check 
CHECK (NOT is_main OR (is_main AND is_active));

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION set_main_wallet(uuid) TO authenticated;

-- Add documentation
COMMENT ON FUNCTION set_main_wallet(uuid) IS 'Sets the specified wallet as the main wallet (admin only). Only active wallets can be set as main.'; 