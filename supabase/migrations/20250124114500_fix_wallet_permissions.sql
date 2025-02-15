-- Drop existing policies first
DO $$ BEGIN
  DROP POLICY IF EXISTS "merchant_wallets_policy" ON merchant_wallets;
  DROP POLICY IF EXISTS "collection_wallets_policy" ON collection_wallets;
  DROP POLICY IF EXISTS "Public can view active merchant wallets" ON merchant_wallets;
  DROP POLICY IF EXISTS "Only admins can manage merchant wallets" ON merchant_wallets;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Enable RLS
ALTER TABLE merchant_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_wallets ENABLE ROW LEVEL SECURITY;

-- Create simplified policies for merchant_wallets
CREATE POLICY "merchant_wallets_admin_access"
  ON merchant_wallets
  FOR ALL
  TO authenticated
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin());

-- Create simplified policies for collection_wallets
CREATE POLICY "collection_wallets_admin_access"
  ON collection_wallets
  FOR ALL
  TO authenticated
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin());

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