-- Disable email confirmation for wallet users
BEGIN;

-- Update auth settings to disable email confirmation for wallet users
-- This allows wallet users to sign in immediately after signup

-- Create a function to check if a user is a wallet user
CREATE OR REPLACE FUNCTION is_wallet_user(user_email text)
RETURNS boolean AS $$
BEGIN
  -- Check if email ends with @wallet.local (our wallet user pattern)
  RETURN user_email LIKE '%@wallet.local';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to automatically confirm wallet users
CREATE OR REPLACE FUNCTION auto_confirm_wallet_users()
RETURNS trigger AS $$
BEGIN
  -- If this is a wallet user, confirm their email immediately
  IF is_wallet_user(NEW.email) THEN
    NEW.email_confirmed_at := now();
    NEW.confirmed_at := now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS auto_confirm_wallet_users_trigger ON auth.users;
CREATE TRIGGER auto_confirm_wallet_users_trigger
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auto_confirm_wallet_users();

-- Update existing wallet users to be confirmed
UPDATE auth.users 
SET 
  email_confirmed_at = now(),
  confirmed_at = now()
WHERE email LIKE '%@wallet.local'
  AND email_confirmed_at IS NULL;

COMMIT;
