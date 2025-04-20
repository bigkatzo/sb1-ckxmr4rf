-- Enable pgcrypto extension if it doesn't already exist
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Verify function works by testing it
DO $$
BEGIN
  PERFORM encode(gen_random_bytes(4), 'hex');
  RAISE NOTICE 'pgcrypto extension is working properly';
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Failed to use gen_random_bytes function: %', SQLERRM;
END $$; 