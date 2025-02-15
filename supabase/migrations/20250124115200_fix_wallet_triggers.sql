-- Drop existing triggers first
DO $$ BEGIN
  DROP TRIGGER IF EXISTS validate_wallet_address_trigger ON merchant_wallets;
  DROP TRIGGER IF EXISTS validate_collection_wallet_trigger ON collection_wallets;
  DROP FUNCTION IF EXISTS validate_wallet_address_trigger();
  DROP FUNCTION IF EXISTS validate_collection_wallet_trigger();
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create improved function to validate wallet address
CREATE OR REPLACE FUNCTION validate_wallet_address_trigger()
RETURNS trigger AS $$
BEGIN
  -- Skip validation if address hasn't changed
  IF TG_OP = 'UPDATE' AND NEW.address = OLD.address THEN
    RETURN NEW;
  END IF;

  -- Validate address format
  IF NOT validate_wallet_address(NEW.address) THEN
    RAISE EXCEPTION 'Invalid wallet address format. Must be 32-44 characters long and contain only valid characters.';
  END IF;

  -- Check for duplicate addresses
  IF EXISTS (
    SELECT 1 FROM merchant_wallets
    WHERE address = NEW.address
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) THEN
    RAISE EXCEPTION 'Wallet address already exists';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create improved function to validate collection wallet assignment
CREATE OR REPLACE FUNCTION validate_collection_wallet_trigger()
RETURNS trigger AS $$
BEGIN
  -- Check if wallet exists and is active
  IF NOT EXISTS (
    SELECT 1 FROM merchant_wallets
    WHERE id = NEW.wallet_id
    AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Cannot assign inactive or non-existent wallet to collection';
  END IF;

  -- Check if collection exists
  IF NOT EXISTS (
    SELECT 1 FROM collections
    WHERE id = NEW.collection_id
  ) THEN
    RAISE EXCEPTION 'Collection does not exist';
  END IF;

  -- Check if another collection already uses this wallet
  IF EXISTS (
    SELECT 1 FROM collection_wallets
    WHERE wallet_id = NEW.wallet_id
    AND collection_id != NEW.collection_id
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) THEN
    RAISE EXCEPTION 'This wallet is already assigned to another collection';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for wallet address validation
CREATE TRIGGER validate_wallet_address_trigger
  BEFORE INSERT OR UPDATE ON merchant_wallets
  FOR EACH ROW
  EXECUTE FUNCTION validate_wallet_address_trigger();

-- Create trigger for collection wallet validation
CREATE TRIGGER validate_collection_wallet_trigger
  BEFORE INSERT OR UPDATE ON collection_wallets
  FOR EACH ROW
  EXECUTE FUNCTION validate_collection_wallet_trigger();

-- Ensure RLS is enabled
ALTER TABLE merchant_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_wallets ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies with better error messages
DO $$ BEGIN
  DROP POLICY IF EXISTS "merchant_wallets_read" ON merchant_wallets;
  DROP POLICY IF EXISTS "merchant_wallets_write" ON merchant_wallets;
  DROP POLICY IF EXISTS "merchant_wallets_modify" ON merchant_wallets;
  DROP POLICY IF EXISTS "merchant_wallets_delete" ON merchant_wallets;
  DROP POLICY IF EXISTS "collection_wallets_read" ON collection_wallets;
  DROP POLICY IF EXISTS "collection_wallets_write" ON collection_wallets;
  DROP POLICY IF EXISTS "collection_wallets_modify" ON collection_wallets;
  DROP POLICY IF EXISTS "collection_wallets_delete" ON collection_wallets;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Recreate merchant wallet policies
CREATE POLICY "merchant_wallets_read"
  ON merchant_wallets
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "merchant_wallets_write"
  ON merchant_wallets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    CASE 
      WHEN NOT auth.is_admin() THEN 
        (RAISE EXCEPTION 'Only admin users can create wallets')
      ELSE true
    END
  );

CREATE POLICY "merchant_wallets_modify"
  ON merchant_wallets
  FOR UPDATE
  TO authenticated
  USING (
    CASE 
      WHEN NOT auth.is_admin() THEN 
        (RAISE EXCEPTION 'Only admin users can modify wallets')
      ELSE true
    END
  )
  WITH CHECK (
    CASE 
      WHEN NOT auth.is_admin() THEN 
        (RAISE EXCEPTION 'Only admin users can modify wallets')
      ELSE true
    END
  );

CREATE POLICY "merchant_wallets_delete"
  ON merchant_wallets
  FOR DELETE
  TO authenticated
  USING (
    CASE 
      WHEN NOT auth.is_admin() THEN 
        (RAISE EXCEPTION 'Only admin users can delete wallets')
      ELSE true
    END
  );

-- Recreate collection wallet policies
CREATE POLICY "collection_wallets_read"
  ON collection_wallets
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "collection_wallets_write"
  ON collection_wallets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    CASE 
      WHEN NOT auth.is_admin() THEN 
        (RAISE EXCEPTION 'Only admin users can assign wallets to collections')
      ELSE true
    END
  );

CREATE POLICY "collection_wallets_modify"
  ON collection_wallets
  FOR UPDATE
  TO authenticated
  USING (
    CASE 
      WHEN NOT auth.is_admin() THEN 
        (RAISE EXCEPTION 'Only admin users can modify collection wallet assignments')
      ELSE true
    END
  )
  WITH CHECK (
    CASE 
      WHEN NOT auth.is_admin() THEN 
        (RAISE EXCEPTION 'Only admin users can modify collection wallet assignments')
      ELSE true
    END
  );

CREATE POLICY "collection_wallets_delete"
  ON collection_wallets
  FOR DELETE
  TO authenticated
  USING (
    CASE 
      WHEN NOT auth.is_admin() THEN 
        (RAISE EXCEPTION 'Only admin users can remove wallet assignments')
      ELSE true
    END
  );

-- Grant necessary permissions
GRANT ALL ON merchant_wallets TO authenticated;
GRANT ALL ON collection_wallets TO authenticated;
GRANT EXECUTE ON FUNCTION set_main_wallet(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_wallet_address(text) TO authenticated; 