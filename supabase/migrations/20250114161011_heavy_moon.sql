-- Create collection_wallets table for wallet assignments
CREATE TABLE collection_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid REFERENCES collections(id) ON DELETE CASCADE NOT NULL,
  wallet_id uuid REFERENCES merchant_wallets(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(collection_id)
);

-- Enable RLS
ALTER TABLE collection_wallets ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Public can view collection wallets"
  ON collection_wallets FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_id
      AND c.visible = true
    )
  );

CREATE POLICY "Only admins can manage collection wallets"
  ON collection_wallets FOR ALL
  TO authenticated
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin());

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_collection_wallet_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_collection_wallet_timestamp
  BEFORE UPDATE ON collection_wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_collection_wallet_updated_at();

-- Grant necessary permissions
GRANT ALL ON collection_wallets TO authenticated;