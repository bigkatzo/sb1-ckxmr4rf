-- Drop existing constraint if it exists
DROP INDEX IF EXISTS idx_merchant_wallets_main;
ALTER TABLE merchant_wallets DROP CONSTRAINT IF EXISTS merchant_wallets_main_key;

-- Create unique constraint for main wallet
ALTER TABLE merchant_wallets 
ADD CONSTRAINT merchant_wallets_main_key 
UNIQUE (is_main)
WHERE is_main = true; 