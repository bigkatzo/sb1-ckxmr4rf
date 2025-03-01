-- Drop existing constraints if they exist
DROP INDEX IF EXISTS idx_merchant_wallets_main;
ALTER TABLE merchant_wallets DROP CONSTRAINT IF EXISTS merchant_wallets_main_key;

-- Create unique index for main wallet
CREATE UNIQUE INDEX idx_merchant_wallets_main 
ON merchant_wallets (is_main)
WHERE is_main; 