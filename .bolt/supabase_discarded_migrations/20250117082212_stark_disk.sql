-- Drop existing policies first
DO $$ BEGIN
  DROP POLICY IF EXISTS "merchant_wallets_policy" ON merchant_wallets;
  DROP POLICY IF EXISTS "collection_wallets_policy" ON collection_wallets;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create function to set main wallet with proper error handling
CREATE OR REPLACE FUNCTION set_main_wallet(p_wallet_id uuid)
RETURNS void AS $$
BEGIN
  -- Verify caller is admin
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin can set main wallet';
  END IF;

  -- Verify wallet exists and is active
  IF NOT EXISTS (
    SELECT 1 FROM merchant_wallets
    WHERE id = p_wallet_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Wallet not found or inactive';
  END IF;

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

-- Create function to validate wallet address
CREATE OR REPLACE FUNCTION validate_wallet_address(address text)
RETURNS boolean AS $$
BEGIN
  RETURN address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create trigger function to validate wallet address
CREATE OR REPLACE FUNCTION validate_wallet_address_trigger()
RETURNS trigger AS $$
BEGIN
  IF NOT validate_wallet_address(NEW.address) THEN
    RAISE EXCEPTION 'Invalid wallet address format';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for wallet address validation
DROP TRIGGER IF EXISTS validate_wallet_address_trigger ON merchant_wallets;
CREATE TRIGGER validate_wallet_address_trigger
  BEFORE INSERT OR UPDATE ON merchant_wallets
  FOR EACH ROW
  EXECUTE FUNCTION validate_wallet_address_trigger();

-- Create trigger function to validate collection wallet assignment
CREATE OR REPLACE FUNCTION validate_collection_wallet_trigger()
RETURNS trigger AS $$
BEGIN
  -- Check if wallet is active
  IF NOT EXISTS (
    SELECT 1 FROM merchant_wallets
    WHERE id = NEW.wallet_id
    AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Cannot assign inactive wallet to collection';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for collection wallet validation
DROP TRIGGER IF EXISTS validate_collection_wallet_trigger ON collection_wallets;
CREATE TRIGGER validate_collection_wallet_trigger
  BEFORE INSERT OR UPDATE ON collection_wallets
  FOR EACH ROW
  EXECUTE FUNCTION validate_collection_wallet_trigger();

-- Create separate policies for each operation on merchant_wallets
CREATE POLICY "merchant_wallets_select"
  ON merchant_wallets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "merchant_wallets_insert"
  ON merchant_wallets FOR INSERT
  TO authenticated
  WITH CHECK (auth.is_admin());

CREATE POLICY "merchant_wallets_update"
  ON merchant_wallets FOR UPDATE
  TO authenticated
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin());

CREATE POLICY "merchant_wallets_delete"
  ON merchant_wallets FOR DELETE
  TO authenticated
  USING (auth.is_admin());

-- Create separate policies for each operation on collection_wallets
CREATE POLICY "collection_wallets_select"
  ON collection_wallets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "collection_wallets_insert"
  ON collection_wallets FOR INSERT
  TO authenticated
  WITH CHECK (auth.is_admin());

CREATE POLICY "collection_wallets_update"
  ON collection_wallets FOR UPDATE
  TO authenticated
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin());

CREATE POLICY "collection_wallets_delete"
  ON collection_wallets FOR DELETE
  TO authenticated
  USING (auth.is_admin());

-- Add constraint to ensure only one wallet per collection
ALTER TABLE collection_wallets
  DROP CONSTRAINT IF EXISTS unique_collection_wallet,
  ADD CONSTRAINT unique_collection_wallet 
    UNIQUE (collection_id);

-- Grant necessary permissions
GRANT ALL ON merchant_wallets TO authenticated;
GRANT ALL ON collection_wallets TO authenticated;
GRANT EXECUTE ON FUNCTION set_main_wallet(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_wallet_address(text) TO authenticated;