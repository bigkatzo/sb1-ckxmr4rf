-- Drop existing policies first
DO $$ BEGIN
  DROP POLICY IF EXISTS "users_read_own_profile" ON user_profiles;
  DROP POLICY IF EXISTS "admin_manage_profiles" ON user_profiles;
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

-- Ensure RLS is enabled
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_wallets ENABLE ROW LEVEL SECURITY;

-- Create improved admin check function
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- User profile policies
CREATE POLICY "users_read_own_profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR auth.is_admin());

CREATE POLICY "admin_manage_profiles"
  ON user_profiles
  FOR ALL
  TO authenticated
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin());

-- Merchant wallet policies
CREATE POLICY "merchant_wallets_read"
  ON merchant_wallets
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "merchant_wallets_write"
  ON merchant_wallets
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.is_admin());

CREATE POLICY "merchant_wallets_modify"
  ON merchant_wallets
  FOR UPDATE
  TO authenticated
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin());

CREATE POLICY "merchant_wallets_delete"
  ON merchant_wallets
  FOR DELETE
  TO authenticated
  USING (auth.is_admin());

-- Collection wallet policies
CREATE POLICY "collection_wallets_read"
  ON collection_wallets
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "collection_wallets_write"
  ON collection_wallets
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.is_admin());

CREATE POLICY "collection_wallets_modify"
  ON collection_wallets
  FOR UPDATE
  TO authenticated
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin());

CREATE POLICY "collection_wallets_delete"
  ON collection_wallets
  FOR DELETE
  TO authenticated
  USING (auth.is_admin());

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT ALL ON user_profiles TO authenticated;
GRANT ALL ON merchant_wallets TO authenticated;
GRANT ALL ON collection_wallets TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION set_main_wallet(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_wallet_address(text) TO authenticated; 