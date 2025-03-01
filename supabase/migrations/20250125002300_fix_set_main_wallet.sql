-- Drop existing function
DROP FUNCTION IF EXISTS set_main_wallet(uuid);

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

  -- Update main wallet status in a single atomic operation
  UPDATE merchant_wallets
  SET is_main = (id = p_wallet_id);

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