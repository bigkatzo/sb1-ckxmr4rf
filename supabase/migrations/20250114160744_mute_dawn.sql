-- Create merchant_wallets table
CREATE TABLE merchant_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address text NOT NULL CHECK (address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  label text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add unique constraint on address
ALTER TABLE merchant_wallets
  ADD CONSTRAINT unique_merchant_wallet_address UNIQUE (address);

-- Enable RLS
ALTER TABLE merchant_wallets ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Public can view active merchant wallets"
  ON merchant_wallets FOR SELECT
  TO public
  USING (is_active = true);

CREATE POLICY "Only admins can manage merchant wallets"
  ON merchant_wallets FOR ALL
  TO authenticated
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin());

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_merchant_wallet_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_merchant_wallet_timestamp
  BEFORE UPDATE ON merchant_wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_merchant_wallet_updated_at();

-- Grant necessary permissions
GRANT ALL ON merchant_wallets TO authenticated;