-- Add is_main column to merchant_wallets
ALTER TABLE merchant_wallets
ADD COLUMN IF NOT EXISTS is_main boolean DEFAULT false;

-- Create unique constraint to ensure only one main wallet
CREATE UNIQUE INDEX IF NOT EXISTS idx_merchant_wallets_main
ON merchant_wallets (is_main)
WHERE is_main = true;

-- Create function to set main wallet
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

  -- Start transaction
  BEGIN
    -- First, set all wallets to not main
    UPDATE merchant_wallets
    SET is_main = false
    WHERE is_main = true;

    -- Then set the specified wallet as main
    UPDATE merchant_wallets
    SET is_main = true
    WHERE id = p_wallet_id;

    -- Verify we have a main wallet
    IF NOT EXISTS (SELECT 1 FROM merchant_wallets WHERE is_main = true) THEN
      RAISE EXCEPTION 'System must have a main wallet';
    END IF;
  EXCEPTION
    WHEN others THEN
      RAISE EXCEPTION 'Failed to set main wallet: %', SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to ensure first wallet is main
CREATE OR REPLACE FUNCTION ensure_first_wallet_is_main()
RETURNS trigger AS $$
BEGIN
  -- If this is the first wallet being inserted
  IF (SELECT COUNT(*) FROM merchant_wallets) = 1 THEN
    NEW.is_main = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to ensure first wallet is main
DROP TRIGGER IF EXISTS ensure_first_wallet_is_main_trigger ON merchant_wallets;
CREATE TRIGGER ensure_first_wallet_is_main_trigger
  BEFORE INSERT ON merchant_wallets
  FOR EACH ROW
  EXECUTE FUNCTION ensure_first_wallet_is_main();

-- Create function to get default wallet for collection
CREATE OR REPLACE FUNCTION get_collection_wallet(p_collection_id uuid)
RETURNS uuid AS $$
DECLARE
  v_wallet_id uuid;
BEGIN
  -- Only allow admin to get collection wallet
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin can get collection wallet';
  END IF;

  -- First try to get specifically assigned wallet
  SELECT wallet_id INTO v_wallet_id
  FROM collection_wallets
  WHERE collection_id = p_collection_id;

  -- If no assigned wallet, get main wallet
  IF v_wallet_id IS NULL THEN
    SELECT id INTO v_wallet_id
    FROM merchant_wallets
    WHERE is_main = true
    AND is_active = true;
  END IF;

  RETURN v_wallet_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure at least one wallet is marked as main
DO $$ 
DECLARE
  v_main_exists boolean;
  v_first_active_wallet_id uuid;
BEGIN
  -- Check if any wallet is marked as main
  SELECT EXISTS (
    SELECT 1 FROM merchant_wallets WHERE is_main = true
  ) INTO v_main_exists;

  -- If no main wallet exists, set the first active wallet as main
  IF NOT v_main_exists THEN
    SELECT id INTO v_first_active_wallet_id
    FROM merchant_wallets
    WHERE is_active = true
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_first_active_wallet_id IS NOT NULL THEN
      PERFORM set_main_wallet(v_first_active_wallet_id);
    END IF;
  END IF;
END $$;