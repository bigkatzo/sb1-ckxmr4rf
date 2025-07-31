-- Create custom_data table for storing product customization data
CREATE TABLE IF NOT EXISTS custom_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  customizable_image TEXT, -- S3 URL for the uploaded image
  customizable_text TEXT, -- Custom text input
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_custom_data_order_id ON custom_data(order_id);
CREATE INDEX IF NOT EXISTS idx_custom_data_product_id ON custom_data(product_id);
CREATE INDEX IF NOT EXISTS idx_custom_data_wallet_address ON custom_data(wallet_address);

-- Create a unique constraint to ensure one customization record per order-product combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_data_unique_order_product 
ON custom_data(order_id, product_id);

-- Add RLS policies
ALTER TABLE custom_data ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own customization data
CREATE POLICY "Users can view their own customization data" ON custom_data
  FOR SELECT USING (
    wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address'
    OR wallet_address = current_setting('request.jwt.claims', true)::json->>'sub'
  );

-- Allow authenticated users to insert customization data
CREATE POLICY "Authenticated users can insert customization data" ON custom_data
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow users to update their own customization data
CREATE POLICY "Users can update their own customization data" ON custom_data
  FOR UPDATE USING (
    wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address'
    OR wallet_address = current_setting('request.jwt.claims', true)::json->>'sub'
  );

-- Allow users to delete their own customization data
CREATE POLICY "Users can delete their own customization data" ON custom_data
  FOR DELETE USING (
    wallet_address = current_setting('request.jwt.claims', true)::json->>'wallet_address'
    OR wallet_address = current_setting('request.jwt.claims', true)::json->>'sub'
  );

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_custom_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_custom_data_updated_at_trigger
  BEFORE UPDATE ON custom_data
  FOR EACH ROW
  EXECUTE FUNCTION update_custom_data_updated_at(); 