-- Smart Contract Integration Helper Functions
-- These functions provide clean, organized data for smart contract consumption

-- Function to get all wallet distributions for a collection (smart contract ready)
CREATE OR REPLACE FUNCTION get_collection_wallet_distributions(p_collection_id UUID)
RETURNS TABLE (
  wallet_address TEXT,
  recipient_name TEXT,
  share_percentage DECIMAL,
  share_type TEXT,
  user_id UUID,
  is_platform_user BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cis.wallet_address,
    CASE 
      WHEN cis.is_standalone_wallet THEN cis.share_name
      ELSE COALESCE(up.display_name, 'User ' || substring(cis.user_id::text, 1, 8))
    END as recipient_name,
    cis.share_percentage,
    CASE 
      WHEN cis.is_standalone_wallet THEN 'external_wallet'
      ELSE 'platform_user'
    END as share_type,
    cis.user_id,
    NOT cis.is_standalone_wallet as is_platform_user
  FROM collection_individual_shares cis
  LEFT JOIN user_profiles up ON cis.user_id = up.id
  WHERE cis.collection_id = p_collection_id
    AND cis.is_active = true
    AND (cis.effective_until IS NULL OR cis.effective_until > NOW())
    AND cis.effective_from <= NOW()
    AND cis.wallet_address IS NOT NULL
  ORDER BY cis.share_percentage DESC;
END;
$$;

-- Function to get wallet distributions in smart contract format (simple array)
CREATE OR REPLACE FUNCTION get_smart_contract_distributions(p_collection_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  distributions JSONB := '[]'::JSONB;
  total_percentage DECIMAL := 0;
  distribution_record RECORD;
BEGIN
  -- Get all wallet distributions
  FOR distribution_record IN
    SELECT * FROM get_collection_wallet_distributions(p_collection_id)
  LOOP
    -- Add to distributions array
    distributions := distributions || jsonb_build_object(
      'wallet', distribution_record.wallet_address,
      'percentage', distribution_record.share_percentage,
      'recipient', distribution_record.recipient_name,
      'type', distribution_record.share_type
    );
    
    total_percentage := total_percentage + distribution_record.share_percentage;
  END LOOP;
  
  -- Return complete distribution data
  RETURN jsonb_build_object(
    'collection_id', p_collection_id,
    'distributions', distributions,
    'total_percentage', total_percentage,
    'is_valid', total_percentage <= 100,
    'timestamp', NOW()
  );
END;
$$;

-- Function to validate collection is ready for smart contract deployment
CREATE OR REPLACE FUNCTION validate_collection_for_smart_contract(p_collection_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  validation_result JSONB;
  wallet_count INTEGER;
  total_percentage DECIMAL;
  missing_wallets INTEGER;
  valid_wallets INTEGER;
BEGIN
  -- Count total shares
  SELECT COUNT(*) INTO wallet_count
  FROM collection_individual_shares
  WHERE collection_id = p_collection_id AND is_active = true;
  
  -- Calculate total percentage
  SELECT COALESCE(SUM(share_percentage), 0) INTO total_percentage
  FROM collection_individual_shares
  WHERE collection_id = p_collection_id AND is_active = true;
  
  -- Count missing wallets
  SELECT COUNT(*) INTO missing_wallets
  FROM collection_individual_shares
  WHERE collection_id = p_collection_id 
    AND is_active = true 
    AND wallet_address IS NULL;
  
  -- Count valid wallets
  SELECT COUNT(*) INTO valid_wallets
  FROM collection_individual_shares
  WHERE collection_id = p_collection_id 
    AND is_active = true 
    AND wallet_address IS NOT NULL
    AND wallet_address ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$';
  
  -- Build validation result
  validation_result := jsonb_build_object(
    'collection_id', p_collection_id,
    'is_ready', total_percentage = 100 AND missing_wallets = 0 AND valid_wallets = wallet_count,
    'total_shares', wallet_count,
    'total_percentage', total_percentage,
    'valid_wallets', valid_wallets,
    'missing_wallets', missing_wallets,
    'issues', CASE
      WHEN total_percentage != 100 THEN jsonb_build_array('Total percentage must equal 100%')
      WHEN missing_wallets > 0 THEN jsonb_build_array('Some shares missing wallet addresses')
      WHEN valid_wallets != wallet_count THEN jsonb_build_array('Some wallet addresses are invalid')
      ELSE jsonb_build_array()
    END,
    'validated_at', NOW()
  );
  
  RETURN validation_result;
END;
$$;

-- View for easy smart contract data access
CREATE OR REPLACE VIEW smart_contract_ready_collections AS
SELECT 
  c.id as collection_id,
  c.name as collection_name,
  c.user_id as owner_id,
  COUNT(cis.id) as total_shares,
  COALESCE(SUM(cis.share_percentage), 0) as total_percentage,
  COUNT(CASE WHEN cis.wallet_address IS NOT NULL THEN 1 END) as wallets_configured,
  COUNT(CASE WHEN cis.wallet_address IS NULL THEN 1 END) as missing_wallets,
  CASE 
    WHEN COALESCE(SUM(cis.share_percentage), 0) = 100 
         AND COUNT(CASE WHEN cis.wallet_address IS NULL THEN 1 END) = 0
    THEN true 
    ELSE false 
  END as is_smart_contract_ready
FROM collections c
LEFT JOIN collection_individual_shares cis ON c.id = cis.collection_id AND cis.is_active = true
GROUP BY c.id, c.name, c.user_id;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_collection_wallet_distributions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_smart_contract_distributions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_collection_for_smart_contract(UUID) TO authenticated;
GRANT SELECT ON smart_contract_ready_collections TO authenticated;

-- Comments for documentation
COMMENT ON FUNCTION get_collection_wallet_distributions IS 'Returns wallet addresses and percentages for smart contract distribution';
COMMENT ON FUNCTION get_smart_contract_distributions IS 'Returns distribution data in JSON format optimized for smart contracts';
COMMENT ON FUNCTION validate_collection_for_smart_contract IS 'Validates if collection is ready for smart contract deployment';
COMMENT ON VIEW smart_contract_ready_collections IS 'Shows which collections are ready for smart contract integration'; 