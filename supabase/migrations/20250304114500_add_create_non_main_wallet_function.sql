-- Create a function to create a wallet that is guaranteed not to be set as main
-- This bypasses any triggers that might attempt to set is_main=true
CREATE OR REPLACE FUNCTION create_non_main_wallet(
  p_address text,
  p_label text
)
RETURNS uuid AS $$
DECLARE
  v_wallet_id uuid;
  v_wallet_count int;
  v_has_main_wallet boolean;
BEGIN
  -- Only allow admin to create wallets
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin can create wallets';
  END IF;

  -- Validate address format
  IF NOT p_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' THEN
    RAISE EXCEPTION 'Invalid wallet address format';
  END IF;

  -- First check if there are existing wallets and if there's already a main wallet
  SELECT 
    COUNT(*), 
    EXISTS(SELECT 1 FROM merchant_wallets WHERE is_main = true)
  INTO 
    v_wallet_count, 
    v_has_main_wallet
  FROM merchant_wallets;

  -- CASE 1: This is the first wallet, so it will become main due to triggers
  -- We need to create a dummy wallet first to prevent this wallet from becoming main
  IF v_wallet_count = 0 THEN
    -- Create a temporary wallet that will become main
    INSERT INTO merchant_wallets (
      address,
      label,
      is_active,
      is_main
    ) VALUES (
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',  -- Temporary address
      'TEMP_MAIN_WALLET',
      true,
      true
    );
  END IF;

  -- Now create the actual wallet with is_main explicitly set to false
  INSERT INTO merchant_wallets (
    address,
    label,
    is_active,
    is_main
  )
  VALUES (
    p_address,
    p_label,
    true,
    false
  )
  RETURNING id INTO v_wallet_id;

  -- CASE 1 cleanup: If we created a temporary wallet, delete it and set a proper main wallet
  IF v_wallet_count = 0 THEN
    -- Delete the temporary wallet
    DELETE FROM merchant_wallets WHERE label = 'TEMP_MAIN_WALLET';
    
    -- Now set the new wallet as main since we need one main wallet
    UPDATE merchant_wallets
    SET is_main = true
    WHERE id = v_wallet_id;
  END IF;

  RETURN v_wallet_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION create_non_main_wallet(text, text) TO authenticated;

-- Add documentation
COMMENT ON FUNCTION create_non_main_wallet(text, text) IS 'Creates a new wallet that is guaranteed not to be set as main unless there are no other wallets.'; 