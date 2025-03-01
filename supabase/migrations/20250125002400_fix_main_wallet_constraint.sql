-- Drop existing constraint if it exists
DROP INDEX IF EXISTS idx_merchant_wallets_main;

-- Create partial unique index for main wallet
CREATE UNIQUE INDEX idx_merchant_wallets_main ON merchant_wallets ((true)) WHERE is_main = true; 