-- Add accepted_tokens column to categories table
ALTER TABLE categories ADD COLUMN IF NOT EXISTS accepted_tokens text[] DEFAULT '{"SOL"}';

-- Add comment to column
COMMENT ON COLUMN categories.accepted_tokens IS 'Array of token types accepted for payment in this category'; 