-- Drop existing policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "merchant_wallets_select" ON merchant_wallets;
  DROP POLICY IF EXISTS "merchant_wallets_insert" ON merchant_wallets;
  DROP POLICY IF EXISTS "merchant_wallets_update" ON merchant_wallets;
  DROP POLICY IF EXISTS "merchant_wallets_delete" ON merchant_wallets;
  DROP POLICY IF EXISTS "collection_wallets_select" ON collection_wallets;
  DROP POLICY IF EXISTS "collection_wallets_insert" ON collection_wallets;
  DROP POLICY IF EXISTS "collection_wallets_update" ON collection_wallets;
  DROP POLICY IF EXISTS "collection_wallets_delete" ON collection_wallets;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create function to set main wallet
CREATE OR REPLACE FUNCTION set_main_wallet(p_wallet_id uuid)
RETURNS void AS $$
BEGIN
  -- First, set all wallets to not main
  UPDATE merchant_wallets
  SET is_main = false;

  -- Then set the specified wallet as main
  UPDATE merchant_wallets
  SET is_main = true
  WHERE id = p_wallet_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS
ALTER TABLE merchant_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_wallets ENABLE ROW LEVEL SECURITY;

-- Create simplified policies for merchant_wallets
CREATE POLICY "merchant_wallets_policy"
  ON merchant_wallets
  FOR ALL
  TO authenticated
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin());

-- Create simplified policies for collection_wallets
CREATE POLICY "collection_wallets_policy"
  ON collection_wallets
  FOR ALL
  TO authenticated
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin());

-- Grant necessary permissions
GRANT ALL ON merchant_wallets TO authenticated;
GRANT ALL ON collection_wallets TO authenticated;
GRANT EXECUTE ON FUNCTION set_main_wallet(uuid) TO authenticated;