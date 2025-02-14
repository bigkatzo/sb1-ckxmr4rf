-- Drop existing policies if they exist
DO $$ BEGIN
  DROP POLICY IF EXISTS "merchant_wallets_select" ON merchant_wallets;
  DROP POLICY IF EXISTS "merchant_wallets_insert" ON merchant_wallets;
  DROP POLICY IF EXISTS "merchant_wallets_update" ON merchant_wallets;
  DROP POLICY IF EXISTS "merchant_wallets_delete" ON merchant_wallets;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Enable RLS
ALTER TABLE merchant_wallets ENABLE ROW LEVEL SECURITY;

-- Create policies for merchant_wallets
CREATE POLICY "merchant_wallets_select"
  ON merchant_wallets FOR SELECT
  TO authenticated
  USING (auth.is_admin());

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

-- Create policies for collection_wallets
DROP POLICY IF EXISTS "collection_wallets_select" ON collection_wallets;
DROP POLICY IF EXISTS "collection_wallets_insert" ON collection_wallets;
DROP POLICY IF EXISTS "collection_wallets_update" ON collection_wallets;
DROP POLICY IF EXISTS "collection_wallets_delete" ON collection_wallets;

ALTER TABLE collection_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "collection_wallets_select"
  ON collection_wallets FOR SELECT
  TO authenticated
  USING (auth.is_admin());

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

-- Grant necessary permissions
GRANT ALL ON merchant_wallets TO authenticated;
GRANT ALL ON collection_wallets TO authenticated;