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
  -- Start transaction
  BEGIN
    -- First, set all wallets to not main
    UPDATE merchant_wallets
    SET is_main = false;

    -- Then set the specified wallet as main
    UPDATE merchant_wallets
    SET is_main = true
    WHERE id = p_wallet_id;
  EXCEPTION
    WHEN others THEN
      RAISE EXCEPTION 'Failed to set main wallet: %', SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get default wallet for collection
CREATE OR REPLACE FUNCTION get_collection_wallet(p_collection_id uuid)
RETURNS uuid AS $$
DECLARE
  v_wallet_id uuid;
BEGIN
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