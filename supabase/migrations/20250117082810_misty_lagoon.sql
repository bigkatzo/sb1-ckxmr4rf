-- Create function to ensure main wallet exists
CREATE OR REPLACE FUNCTION ensure_main_wallet()
RETURNS trigger AS $$
DECLARE
  v_active_count integer;
  v_main_exists boolean;
  v_first_active_id uuid;
BEGIN
  -- Get count of active wallets and check if main exists
  SELECT 
    COUNT(*),
    EXISTS(SELECT 1 FROM merchant_wallets WHERE is_main = true AND is_active = true)
  INTO v_active_count, v_main_exists
  FROM merchant_wallets
  WHERE is_active = true;

  -- If we have active wallets but no main wallet
  IF v_active_count > 0 AND NOT v_main_exists THEN
    -- Select the first active wallet by created_at
    SELECT id INTO v_first_active_id
    FROM merchant_wallets
    WHERE is_active = true
    ORDER BY created_at ASC
    LIMIT 1;

    -- Set it as main
    IF v_first_active_id IS NOT NULL THEN
      UPDATE merchant_wallets
      SET is_main = true
      WHERE id = v_first_active_id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to ensure main wallet exists
DROP TRIGGER IF EXISTS ensure_main_wallet_trigger ON merchant_wallets;
CREATE TRIGGER ensure_main_wallet_trigger
  AFTER INSERT OR UPDATE OR DELETE ON merchant_wallets
  FOR EACH STATEMENT
  EXECUTE FUNCTION ensure_main_wallet();

-- Create function to prevent deactivating last active wallet
CREATE OR REPLACE FUNCTION prevent_deactivate_last_wallet()
RETURNS trigger AS $$
DECLARE
  v_active_count integer;
BEGIN
  -- If trying to deactivate a wallet
  IF TG_OP = 'UPDATE' AND OLD.is_active = true AND NEW.is_active = false THEN
    -- Count other active wallets
    SELECT COUNT(*)
    INTO v_active_count
    FROM merchant_wallets
    WHERE is_active = true
    AND id != NEW.id;

    -- If this is the last active wallet, prevent deactivation
    IF v_active_count = 0 THEN
      RAISE EXCEPTION 'Cannot deactivate the last active wallet';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to prevent deactivating last wallet
DROP TRIGGER IF EXISTS prevent_deactivate_last_wallet_trigger ON merchant_wallets;
CREATE TRIGGER prevent_deactivate_last_wallet_trigger
  BEFORE UPDATE ON merchant_wallets
  FOR EACH ROW
  EXECUTE FUNCTION prevent_deactivate_last_wallet();

-- Create function to handle main wallet deactivation
CREATE OR REPLACE FUNCTION handle_main_wallet_deactivation()
RETURNS trigger AS $$
DECLARE
  v_new_main_id uuid;
BEGIN
  -- If deactivating the main wallet
  IF TG_OP = 'UPDATE' AND OLD.is_main = true AND NEW.is_active = false THEN
    -- Find another active wallet to be main
    SELECT id INTO v_new_main_id
    FROM merchant_wallets
    WHERE is_active = true
    AND id != NEW.id
    ORDER BY created_at ASC
    LIMIT 1;

    -- If found, make it the new main wallet
    IF v_new_main_id IS NOT NULL THEN
      UPDATE merchant_wallets
      SET is_main = true
      WHERE id = v_new_main_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to handle main wallet deactivation
DROP TRIGGER IF EXISTS handle_main_wallet_deactivation_trigger ON merchant_wallets;
CREATE TRIGGER handle_main_wallet_deactivation_trigger
  BEFORE UPDATE ON merchant_wallets
  FOR EACH ROW
  EXECUTE FUNCTION handle_main_wallet_deactivation();

-- Create function to ensure first wallet is main
CREATE OR REPLACE FUNCTION ensure_first_wallet_is_main()
RETURNS trigger AS $$
BEGIN
  -- If this is the first wallet being inserted
  IF NOT EXISTS (
    SELECT 1 FROM merchant_wallets
    WHERE id != NEW.id
  ) THEN
    NEW.is_main = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to ensure first wallet is main
DROP TRIGGER IF EXISTS ensure_first_wallet_is_main_trigger ON merchant_wallets;
CREATE TRIGGER ensure_first_wallet_is_main_trigger
  BEFORE INSERT ON merchant_wallets
  FOR EACH ROW
  EXECUTE FUNCTION ensure_first_wallet_is_main();

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION ensure_main_wallet() TO authenticated;
GRANT EXECUTE ON FUNCTION prevent_deactivate_last_wallet() TO authenticated;
GRANT EXECUTE ON FUNCTION handle_main_wallet_deactivation() TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_first_wallet_is_main() TO authenticated;