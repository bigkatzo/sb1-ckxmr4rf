-- Drop existing functions
DROP FUNCTION IF EXISTS list_wallets() CASCADE;
DROP FUNCTION IF EXISTS create_wallet(text, text, text) CASCADE;
DROP FUNCTION IF EXISTS update_wallet(uuid, text, text, text) CASCADE;
DROP FUNCTION IF EXISTS delete_wallet(uuid) CASCADE;

-- Create list_wallets function
CREATE OR REPLACE FUNCTION list_wallets()
RETURNS TABLE (
  id uuid,
  name text,
  address text,
  network text,
  created_at timestamptz,
  updated_at timestamptz
) AS $$
BEGIN
  -- Only allow admin to list wallets
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin can list wallets';
  END IF;

  RETURN QUERY
  SELECT 
    w.id,
    w.name,
    w.address,
    w.network,
    w.created_at,
    w.updated_at
  FROM wallets w
  ORDER BY w.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create wallet management functions
CREATE OR REPLACE FUNCTION create_wallet(
  p_name text,
  p_address text,
  p_network text DEFAULT 'mainnet'
)
RETURNS uuid AS $$
DECLARE
  v_wallet_id uuid;
BEGIN
  -- Only allow admin to create wallets
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin can create wallets';
  END IF;

  -- Validate address format
  IF NOT p_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' THEN
    RAISE EXCEPTION 'Invalid wallet address format';
  END IF;

  -- Create wallet
  INSERT INTO wallets (
    name,
    address,
    network,
    created_at,
    updated_at
  )
  VALUES (
    p_name,
    p_address,
    p_network,
    now(),
    now()
  )
  RETURNING id INTO v_wallet_id;

  RETURN v_wallet_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update wallet
CREATE OR REPLACE FUNCTION update_wallet(
  p_wallet_id uuid,
  p_name text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_network text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  -- Only allow admin to update wallets
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin can update wallets';
  END IF;

  -- Validate address format if provided
  IF p_address IS NOT NULL AND NOT p_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' THEN
    RAISE EXCEPTION 'Invalid wallet address format';
  END IF;

  -- Update wallet
  UPDATE wallets
  SET 
    name = COALESCE(p_name, name),
    address = COALESCE(p_address, address),
    network = COALESCE(p_network, network),
    updated_at = now()
  WHERE id = p_wallet_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to delete wallet
CREATE OR REPLACE FUNCTION delete_merchant_wallet(
  p_wallet_id uuid
)
RETURNS void AS $$
BEGIN
  -- Verify caller is admin
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin can delete wallets';
  END IF;

  -- Check if wallet exists
  IF NOT EXISTS (SELECT 1 FROM merchant_wallets WHERE id = p_wallet_id) THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  -- Check if this is the main wallet
  IF EXISTS (SELECT 1 FROM merchant_wallets WHERE id = p_wallet_id AND is_main = true) THEN
    RAISE EXCEPTION 'Cannot delete the main wallet. Please set another wallet as main first.';
  END IF;

  -- Delete the wallet (will cascade to collection_wallets)
  DELETE FROM merchant_wallets
  WHERE id = p_wallet_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Failed to delete wallet';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION list_wallets() TO authenticated;
GRANT EXECUTE ON FUNCTION create_wallet(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION update_wallet(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_merchant_wallet(uuid) TO authenticated; 