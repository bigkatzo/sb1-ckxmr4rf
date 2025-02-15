-- Drop existing policies first
DO $$ BEGIN
  DROP POLICY IF EXISTS "merchant_wallets_policy" ON merchant_wallets;
  DROP POLICY IF EXISTS "collection_wallets_policy" ON collection_wallets;
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

-- Enable RLS
ALTER TABLE merchant_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_wallets ENABLE ROW LEVEL SECURITY;

-- Create simplified policies for merchant_wallets
CREATE POLICY "merchant_wallets_read"
  ON merchant_wallets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "merchant_wallets_write"
  ON merchant_wallets FOR INSERT
  TO authenticated
  WITH CHECK (auth.is_admin());

CREATE POLICY "merchant_wallets_modify"
  ON merchant_wallets FOR UPDATE
  TO authenticated
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin());

CREATE POLICY "merchant_wallets_delete"
  ON merchant_wallets FOR DELETE
  TO authenticated
  USING (auth.is_admin());

-- Create simplified policies for collection_wallets
CREATE POLICY "collection_wallets_read"
  ON collection_wallets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "collection_wallets_write"
  ON collection_wallets FOR INSERT
  TO authenticated
  WITH CHECK (auth.is_admin());

CREATE POLICY "collection_wallets_modify"
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
GRANT EXECUTE ON FUNCTION set_main_wallet(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_wallet_address(text) TO authenticated;

-- Ensure admin420 has admin role
DO $$ 
DECLARE
  v_user_id uuid;
BEGIN
  -- Get admin420's user ID
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'admin420@merchant.local';

  -- Ensure profile exists with admin role
  INSERT INTO user_profiles (id, role)
  VALUES (v_user_id, 'admin')
  ON CONFLICT (id) DO UPDATE
  SET role = 'admin';
END $$; 