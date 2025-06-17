-- Finance Management System Migration
-- This creates the complete revenue sharing infrastructure

-- Collection Revenue Configuration Table
CREATE TABLE IF NOT EXISTS collection_revenue_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  owner_share_percentage INTEGER NOT NULL DEFAULT 100 CHECK (owner_share_percentage >= 0 AND owner_share_percentage <= 100),
  editor_share_percentage INTEGER NOT NULL DEFAULT 0 CHECK (editor_share_percentage >= 0 AND editor_share_percentage <= 100),
  collaborator_share_percentage INTEGER NOT NULL DEFAULT 0 CHECK (collaborator_share_percentage >= 0 AND collaborator_share_percentage <= 100),
  viewer_share_percentage INTEGER NOT NULL DEFAULT 0 CHECK (viewer_share_percentage >= 0 AND viewer_share_percentage <= 100),
  split_model TEXT NOT NULL DEFAULT 'owner_only' CHECK (split_model IN ('owner_only', 'equal_split', 'contribution_based', 'custom')),
  enable_individual_splits BOOLEAN NOT NULL DEFAULT FALSE,
  smart_contract_address TEXT,
  auto_distribute BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(collection_id),
  -- Ensure total percentages don't exceed 100%
  CHECK (owner_share_percentage + editor_share_percentage + collaborator_share_percentage + viewer_share_percentage <= 100)
);

-- Collection Individual Shares Table (for custom per-user revenue splits)
CREATE TABLE IF NOT EXISTS collection_individual_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_type TEXT NOT NULL CHECK (access_type IN ('view', 'edit', 'owner', 'collaborator')),
  share_percentage DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (share_percentage >= 0 AND share_percentage <= 100),
  share_type TEXT NOT NULL DEFAULT 'percentage' CHECK (share_type IN ('percentage', 'fixed_amount', 'per_item')),
  fixed_amount DECIMAL(10,2),
  wallet_address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(collection_id, user_id, is_active) DEFERRABLE INITIALLY DEFERRED,
  -- Ensure effective dates are logical
  CHECK (effective_until IS NULL OR effective_until > effective_from),
  -- Ensure fixed_amount is provided when share_type is 'fixed_amount'
  CHECK (share_type != 'fixed_amount' OR fixed_amount IS NOT NULL)
);

-- Revenue Events Table (tracks all sales and revenue distribution)
CREATE TABLE IF NOT EXISTS revenue_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  order_id UUID, -- Reference to orders when that system is implemented
  total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  primary_contributor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revenue_splits JSONB NOT NULL DEFAULT '[]', -- Array of {user_id, amount, percentage}
  transaction_hash TEXT, -- For blockchain transactions
  smart_contract_address TEXT,
  block_number BIGINT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed', 'disputed')),
  sale_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_revenue_config_collection ON collection_revenue_config(collection_id);
CREATE INDEX IF NOT EXISTS idx_individual_shares_collection ON collection_individual_shares(collection_id);
CREATE INDEX IF NOT EXISTS idx_individual_shares_user ON collection_individual_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_individual_shares_active ON collection_individual_shares(collection_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_revenue_events_collection ON revenue_events(collection_id);
CREATE INDEX IF NOT EXISTS idx_revenue_events_date ON revenue_events(sale_date);
CREATE INDEX IF NOT EXISTS idx_revenue_events_status ON revenue_events(status);

-- Enable RLS
ALTER TABLE collection_revenue_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_individual_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for collection_revenue_config
CREATE POLICY "Users can view revenue config for collections they have access to"
  ON collection_revenue_config FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM get_collection_access_details(collection_id, auth.uid())
      WHERE access_type IS NOT NULL
    )
  );

CREATE POLICY "Owners and admins can manage revenue config"
  ON collection_revenue_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM get_collection_access_details(collection_id, auth.uid())
      WHERE access_type IN ('owner') OR is_admin = true
    )
  );

-- RLS Policies for collection_individual_shares
CREATE POLICY "Users can view individual shares for collections they have access to"
  ON collection_individual_shares FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM get_collection_access_details(collection_id, auth.uid())
      WHERE access_type IS NOT NULL
    )
  );

CREATE POLICY "Owners and admins can manage individual shares"
  ON collection_individual_shares FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM get_collection_access_details(collection_id, auth.uid())
      WHERE access_type IN ('owner') OR is_admin = true
    )
  );

-- RLS Policies for revenue_events
CREATE POLICY "Users can view revenue events for collections they have access to"
  ON revenue_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM get_collection_access_details(collection_id, auth.uid())
      WHERE access_type IS NOT NULL
    )
  );

CREATE POLICY "Owners and admins can manage revenue events"
  ON revenue_events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM get_collection_access_details(collection_id, auth.uid())
      WHERE access_type IN ('owner') OR is_admin = true
    )
  );

-- Function to calculate revenue splits based on configuration
CREATE OR REPLACE FUNCTION calculate_revenue_splits(
  p_collection_id UUID,
  p_total_amount DECIMAL,
  p_primary_contributor_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  config RECORD;
  splits JSONB := '[]'::JSONB;
  individual_shares RECORD;
  total_individual_percentage INTEGER := 0;
  remaining_amount DECIMAL := p_total_amount;
  user_share RECORD;
BEGIN
  -- Get revenue configuration
  SELECT * INTO config
  FROM collection_revenue_config
  WHERE collection_id = p_collection_id;
  
  -- If no config exists, default to owner-only
  IF NOT FOUND THEN
    -- Find collection owner
    SELECT user_id INTO user_share
    FROM collections
    WHERE id = p_collection_id;
    
    IF FOUND THEN
      splits := splits || jsonb_build_object(
        'user_id', user_share.user_id,
        'amount', p_total_amount,
        'percentage', 100,
        'share_type', 'owner'
      );
    END IF;
    
    RETURN splits;
  END IF;
  
  -- If individual splits are enabled, use those
  IF config.enable_individual_splits THEN
    FOR individual_shares IN
      SELECT user_id, share_percentage, share_type, fixed_amount, access_type
      FROM collection_individual_shares
      WHERE collection_id = p_collection_id
        AND is_active = true
        AND (effective_until IS NULL OR effective_until > NOW())
        AND effective_from <= NOW()
    LOOP
      DECLARE
        share_amount DECIMAL;
      BEGIN
        -- Calculate amount based on share type
        CASE individual_shares.share_type
          WHEN 'percentage' THEN
            share_amount := (p_total_amount * individual_shares.share_percentage / 100.0);
          WHEN 'fixed_amount' THEN
            share_amount := LEAST(individual_shares.fixed_amount, remaining_amount);
          ELSE
            share_amount := (p_total_amount * individual_shares.share_percentage / 100.0);
        END CASE;
        
        IF share_amount > 0 THEN
          splits := splits || jsonb_build_object(
            'user_id', individual_shares.user_id,
            'amount', share_amount,
            'percentage', individual_shares.share_percentage,
            'share_type', individual_shares.access_type,
            'calculation_method', individual_shares.share_type
          );
          
          remaining_amount := remaining_amount - share_amount;
        END IF;
      END;
    END LOOP;
  ELSE
    -- Use default percentages by access type
    -- Get all users with access to this collection
    FOR user_share IN
      SELECT user_id, access_type
      FROM collection_access
      WHERE collection_id = p_collection_id
    LOOP
      DECLARE
        percentage INTEGER := 0;
        share_amount DECIMAL;
      BEGIN
        -- Determine percentage based on access type
        CASE user_share.access_type
          WHEN 'owner' THEN percentage := config.owner_share_percentage;
          WHEN 'edit' THEN percentage := config.editor_share_percentage;
          WHEN 'collaborator' THEN percentage := config.collaborator_share_percentage;
          WHEN 'view' THEN percentage := config.viewer_share_percentage;
        END CASE;
        
        IF percentage > 0 THEN
          share_amount := (p_total_amount * percentage / 100.0);
          
          splits := splits || jsonb_build_object(
            'user_id', user_share.user_id,
            'amount', share_amount,
            'percentage', percentage,
            'share_type', user_share.access_type,
            'calculation_method', 'default_percentage'
          );
        END IF;
      END;
    END LOOP;
  END IF;
  
  RETURN splits;
END;
$$;

-- Function to record a revenue event
CREATE OR REPLACE FUNCTION record_revenue_event(
  p_collection_id UUID,
  p_product_id UUID,
  p_total_amount DECIMAL,
  p_currency TEXT DEFAULT 'USD',
  p_primary_contributor_id UUID DEFAULT NULL,
  p_order_id UUID DEFAULT NULL,
  p_transaction_hash TEXT DEFAULT NULL,
  p_smart_contract_address TEXT DEFAULT NULL,
  p_block_number BIGINT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  event_id UUID;
  calculated_splits JSONB;
BEGIN
  -- Calculate revenue splits
  calculated_splits := calculate_revenue_splits(
    p_collection_id,
    p_total_amount,
    p_primary_contributor_id
  );
  
  -- Insert revenue event
  INSERT INTO revenue_events (
    collection_id,
    product_id,
    order_id,
    total_amount,
    currency,
    primary_contributor_id,
    revenue_splits,
    transaction_hash,
    smart_contract_address,
    block_number,
    status
  ) VALUES (
    p_collection_id,
    p_product_id,
    p_order_id,
    p_total_amount,
    p_currency,
    p_primary_contributor_id,
    calculated_splits,
    p_transaction_hash,
    p_smart_contract_address,
    p_block_number,
    CASE 
      WHEN p_transaction_hash IS NOT NULL THEN 'processed'
      ELSE 'pending'
    END
  ) RETURNING id INTO event_id;
  
  RETURN event_id;
END;
$$;

-- Updated timestamp triggers
CREATE OR REPLACE TRIGGER update_collection_revenue_config_updated_at
  BEFORE UPDATE ON collection_revenue_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_collection_individual_shares_updated_at
  BEFORE UPDATE ON collection_individual_shares
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_revenue_events_updated_at
  BEFORE UPDATE ON revenue_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON collection_revenue_config TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON collection_individual_shares TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON revenue_events TO authenticated;

GRANT EXECUTE ON FUNCTION calculate_revenue_splits TO authenticated;
GRANT EXECUTE ON FUNCTION record_revenue_event TO authenticated; 