-- Enhance Finance System for Mixed Wallet-Based Distributions
-- This allows both user-based shares (inheriting wallets) and standalone wallet addresses

-- Add wallet support to collection_individual_shares
ALTER TABLE collection_individual_shares 
ADD COLUMN IF NOT EXISTS wallet_address TEXT,
ADD COLUMN IF NOT EXISTS share_name TEXT, -- For custom wallet names like "Marketing Fund"
ADD COLUMN IF NOT EXISTS is_standalone_wallet BOOLEAN DEFAULT FALSE; -- True for non-user wallets

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_collection_individual_shares_wallet ON collection_individual_shares(wallet_address);
CREATE INDEX IF NOT EXISTS idx_collection_individual_shares_standalone ON collection_individual_shares(is_standalone_wallet);

-- Function to get user's wallet from profile
CREATE OR REPLACE FUNCTION get_user_wallet(user_uuid UUID)
RETURNS TEXT AS $$
DECLARE
  wallet TEXT;
BEGIN
  SELECT payout_wallet INTO wallet
  FROM user_profiles
  WHERE id = user_uuid;
  
  RETURN wallet;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to populate wallet addresses for existing shares
CREATE OR REPLACE FUNCTION sync_user_wallets_to_shares()
RETURNS VOID AS $$
BEGIN
  -- Update existing user-based shares with their wallet addresses
  UPDATE collection_individual_shares cis
  SET wallet_address = up.payout_wallet
  FROM user_profiles up
  WHERE cis.user_id = up.id
    AND cis.is_standalone_wallet = false
    AND up.payout_wallet IS NOT NULL
    AND cis.wallet_address IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically sync wallet when user profile changes
CREATE OR REPLACE FUNCTION sync_wallet_on_profile_change()
RETURNS TRIGGER AS $$
BEGIN
  -- When user updates their payout wallet, sync to all their shares
  IF OLD.payout_wallet IS DISTINCT FROM NEW.payout_wallet THEN
    UPDATE collection_individual_shares
    SET wallet_address = NEW.payout_wallet
    WHERE user_id = NEW.id 
      AND is_standalone_wallet = false;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for wallet sync
DROP TRIGGER IF EXISTS sync_wallet_on_profile_change_trigger ON user_profiles;
CREATE TRIGGER sync_wallet_on_profile_change_trigger
  AFTER UPDATE OF payout_wallet ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_wallet_on_profile_change();

-- Trigger to automatically populate wallet when creating user-based shares
CREATE OR REPLACE FUNCTION populate_wallet_on_share_create()
RETURNS TRIGGER AS $$
BEGIN
  -- If it's a user-based share (not standalone), populate wallet from profile
  IF NEW.user_id IS NOT NULL AND NEW.is_standalone_wallet = false THEN
    NEW.wallet_address := get_user_wallet(NEW.user_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for wallet population
DROP TRIGGER IF EXISTS populate_wallet_on_share_create_trigger ON collection_individual_shares;
CREATE TRIGGER populate_wallet_on_share_create_trigger
  BEFORE INSERT ON collection_individual_shares
  FOR EACH ROW
  EXECUTE FUNCTION populate_wallet_on_share_create();

-- Enhanced revenue calculation with wallet support
CREATE OR REPLACE FUNCTION calculate_wallet_revenue_splits(
  p_collection_id UUID,
  p_total_amount DECIMAL,
  p_item_creator_id UUID DEFAULT NULL,
  p_item_id UUID DEFAULT NULL,
  p_item_type TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  splits JSONB := '[]'::JSONB;
  share_record RECORD;
  collaborator_item_share DECIMAL := 0;
  remaining_amount DECIMAL := p_total_amount;
  item_attribution RECORD;
BEGIN
  -- First, check for collaborator item attribution
  IF p_item_creator_id IS NOT NULL AND p_item_id IS NOT NULL AND p_item_type IS NOT NULL THEN
    SELECT * INTO item_attribution
    FROM item_revenue_attribution
    WHERE item_id = p_item_id 
      AND item_type = p_item_type 
      AND creator_id = p_item_creator_id
      AND is_active = true;
      
    IF FOUND THEN
      collaborator_item_share := (p_total_amount * item_attribution.revenue_share_percentage / 100.0);
      
      -- Get collaborator's wallet address
      DECLARE
        collaborator_wallet TEXT;
        collaborator_name TEXT;
      BEGIN
        SELECT up.payout_wallet, COALESCE(up.display_name, 'User ' || substring(up.id::text, 1, 8))
        INTO collaborator_wallet, collaborator_name
        FROM user_profiles up
        WHERE up.id = item_attribution.creator_id;
        
        -- Add collaborator split for their item
        splits := splits || jsonb_build_object(
          'user_id', item_attribution.creator_id,
          'wallet_address', collaborator_wallet,
          'recipient_name', collaborator_name,
          'amount', collaborator_item_share,
          'percentage', item_attribution.revenue_share_percentage,
          'type', 'collaborator_item',
          'item_id', p_item_id,
          'item_type', p_item_type
        );
      END;
      
      remaining_amount := remaining_amount - collaborator_item_share;
    END IF;
  END IF;
  
  -- Then distribute remaining amount based on individual shares
  FOR share_record IN
    SELECT 
      cis.user_id, 
      cis.share_percentage,
      cis.wallet_address,
      cis.share_name,
      cis.is_standalone_wallet,
      CASE 
        WHEN cis.is_standalone_wallet THEN cis.share_name
        ELSE COALESCE(up.display_name, 'User ' || substring(cis.user_id::text, 1, 8))
      END as recipient_name
    FROM collection_individual_shares cis
    LEFT JOIN user_profiles up ON cis.user_id = up.id
    WHERE cis.collection_id = p_collection_id
      AND cis.is_active = true
      AND (cis.effective_until IS NULL OR cis.effective_until > NOW())
      AND cis.effective_from <= NOW()
      AND (p_item_creator_id IS NULL OR cis.user_id != p_item_creator_id) -- Exclude item creator from general splits
    ORDER BY cis.share_percentage DESC
  LOOP
    DECLARE
      share_amount DECIMAL;
    BEGIN
      share_amount := (remaining_amount * share_record.share_percentage / 100.0);
      
      IF share_amount > 0 THEN
        splits := splits || jsonb_build_object(
          'user_id', share_record.user_id,
          'wallet_address', share_record.wallet_address,
          'recipient_name', share_record.recipient_name,
          'amount', share_amount,
          'percentage', share_record.share_percentage,
          'type', CASE 
            WHEN share_record.is_standalone_wallet THEN 'standalone_wallet'
            ELSE 'user_share'
          END,
          'is_standalone', share_record.is_standalone_wallet
        );
      END IF;
    END;
  END LOOP;
  
  RETURN splits;
END;
$$;

-- Function to add standalone wallet to collection
CREATE OR REPLACE FUNCTION add_standalone_wallet_share(
  p_collection_id UUID,
  p_wallet_address TEXT,
  p_share_name TEXT,
  p_percentage DECIMAL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  share_id UUID;
  collection_owner UUID;
BEGIN
  -- Verify caller owns the collection or is admin
  SELECT user_id INTO collection_owner
  FROM collections
  WHERE id = p_collection_id;
  
  IF collection_owner != auth.uid() AND NOT (SELECT public.is_admin()) THEN
    RAISE EXCEPTION 'Only collection owner or admin can add wallet shares';
  END IF;
  
  -- Validate wallet address format (basic Solana address check)
  IF p_wallet_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' THEN
    RAISE EXCEPTION 'Invalid wallet address format';
  END IF;
  
  -- Validate percentage
  IF p_percentage <= 0 OR p_percentage > 100 THEN
    RAISE EXCEPTION 'Percentage must be between 0.01 and 100';
  END IF;
  
  -- Insert standalone wallet share
  INSERT INTO collection_individual_shares (
    collection_id,
    user_id,
    wallet_address,
    share_name,
    share_percentage,
    is_standalone_wallet,
    is_active,
    effective_from
  ) VALUES (
    p_collection_id,
    NULL, -- No user associated
    p_wallet_address,
    p_share_name,
    p_percentage,
    true,
    true,
    NOW()
  ) RETURNING id INTO share_id;
  
  RETURN share_id;
END;
$$;

-- Run wallet sync for existing data
SELECT sync_user_wallets_to_shares();

-- Update existing owner shares to have proper display names
UPDATE collection_individual_shares cis
SET share_name = 'Owner'
FROM collections c
WHERE cis.collection_id = c.id 
  AND cis.user_id = c.user_id 
  AND cis.share_name IS NULL
  AND cis.is_standalone_wallet = false;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_user_wallet(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION sync_user_wallets_to_shares() TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_wallet_revenue_splits(UUID, DECIMAL, UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION add_standalone_wallet_share(UUID, TEXT, TEXT, DECIMAL) TO authenticated;

-- Add helpful comments
COMMENT ON COLUMN collection_individual_shares.wallet_address IS 'Wallet address for payments - inherited from user profile or set manually for standalone wallets';
COMMENT ON COLUMN collection_individual_shares.share_name IS 'Display name for the share recipient (e.g., "Marketing Fund", "Development Team")';
COMMENT ON COLUMN collection_individual_shares.is_standalone_wallet IS 'True for wallet addresses not associated with platform users';
COMMENT ON FUNCTION add_standalone_wallet_share IS 'Add a standalone wallet address to collection revenue sharing';
COMMENT ON FUNCTION calculate_wallet_revenue_splits IS 'Calculate revenue distribution with wallet addresses for payments'; 