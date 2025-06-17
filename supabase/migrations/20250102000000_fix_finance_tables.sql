-- Fix finance management tables and relationships

-- Ensure collection_revenue_config table exists
CREATE TABLE IF NOT EXISTS collection_revenue_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  owner_share_percentage DECIMAL(5,2) NOT NULL DEFAULT 100 CHECK (owner_share_percentage >= 0 AND owner_share_percentage <= 100),
  editor_share_percentage DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (editor_share_percentage >= 0 AND editor_share_percentage <= 100),
  collaborator_share_percentage DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (collaborator_share_percentage >= 0 AND collaborator_share_percentage <= 100),
  viewer_share_percentage DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (viewer_share_percentage >= 0 AND viewer_share_percentage <= 100),
  split_model TEXT NOT NULL DEFAULT 'owner_only' CHECK (split_model IN ('owner_only', 'equal_split', 'contribution_based', 'custom')),
  enable_individual_splits BOOLEAN NOT NULL DEFAULT FALSE,
  smart_contract_address TEXT,
  auto_distribute BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(collection_id),
  -- Ensure percentages don't exceed 100%
  CHECK (owner_share_percentage + editor_share_percentage + collaborator_share_percentage + viewer_share_percentage <= 100)
);

-- Ensure collection_individual_shares table exists  
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

-- Ensure item_revenue_attribution table exists
CREATE TABLE IF NOT EXISTS item_revenue_attribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  item_id UUID NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('product', 'category')),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  revenue_share_percentage DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (revenue_share_percentage >= 0 AND revenue_share_percentage <= 100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(item_id, item_type, is_active) DEFERRABLE INITIALLY DEFERRED
);

-- Ensure revenue_events table exists
CREATE TABLE IF NOT EXISTS revenue_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  order_id UUID,
  total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
  currency TEXT NOT NULL DEFAULT 'SOL',
  primary_contributor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  item_creator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revenue_splits JSONB NOT NULL DEFAULT '[]',
  transaction_hash TEXT,
  smart_contract_address TEXT,
  block_number BIGINT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed', 'disputed')),
  sale_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_revenue_config_collection ON collection_revenue_config(collection_id);
CREATE INDEX IF NOT EXISTS idx_individual_shares_collection ON collection_individual_shares(collection_id);
CREATE INDEX IF NOT EXISTS idx_individual_shares_user ON collection_individual_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_individual_shares_active ON collection_individual_shares(collection_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_item_revenue_attribution_item ON item_revenue_attribution(item_id, item_type);
CREATE INDEX IF NOT EXISTS idx_item_revenue_attribution_creator ON item_revenue_attribution(creator_id);
CREATE INDEX IF NOT EXISTS idx_item_revenue_attribution_collection ON item_revenue_attribution(collection_id);
CREATE INDEX IF NOT EXISTS idx_revenue_events_collection ON revenue_events(collection_id);
CREATE INDEX IF NOT EXISTS idx_revenue_events_date ON revenue_events(sale_date);
CREATE INDEX IF NOT EXISTS idx_revenue_events_status ON revenue_events(status);

-- Enable RLS on all tables
ALTER TABLE collection_revenue_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_individual_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_revenue_attribution ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for collection_revenue_config
DROP POLICY IF EXISTS "Users can view revenue config for collections they have access to" ON collection_revenue_config;
DROP POLICY IF EXISTS "Owners and admins can manage revenue config" ON collection_revenue_config;

CREATE POLICY "Users can view revenue config for collections they have access to"
  ON collection_revenue_config FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_id AND c.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM collection_access ca
      WHERE ca.collection_id = collection_revenue_config.collection_id
      AND ca.user_id = auth.uid()
    )
    OR
    (SELECT is_admin())
  );

CREATE POLICY "Owners and admins can manage revenue config"
  ON collection_revenue_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_id AND c.user_id = auth.uid()
    )
    OR
    (SELECT is_admin())
  );

-- RLS Policies for collection_individual_shares
DROP POLICY IF EXISTS "Users can view individual shares for collections they have access to" ON collection_individual_shares;
DROP POLICY IF EXISTS "Owners and admins can manage individual shares" ON collection_individual_shares;

CREATE POLICY "Users can view individual shares for collections they have access to"
  ON collection_individual_shares FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_id AND c.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM collection_access ca
      WHERE ca.collection_id = collection_individual_shares.collection_id
      AND ca.user_id = auth.uid()
    )
    OR
    (SELECT is_admin())
  );

CREATE POLICY "Owners and admins can manage individual shares"
  ON collection_individual_shares FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_id AND c.user_id = auth.uid()
    )
    OR
    (SELECT is_admin())
  );

-- RLS Policies for item_revenue_attribution
DROP POLICY IF EXISTS "Users can view item attribution for collections they have access to" ON item_revenue_attribution;
DROP POLICY IF EXISTS "Owners and admins can manage item attribution" ON item_revenue_attribution;

CREATE POLICY "Users can view item attribution for collections they have access to"
  ON item_revenue_attribution FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_id AND c.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM collection_access ca
      WHERE ca.collection_id = item_revenue_attribution.collection_id
      AND ca.user_id = auth.uid()
    )
    OR
    (SELECT is_admin())
  );

CREATE POLICY "Owners and admins can manage item attribution"
  ON item_revenue_attribution FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_id AND c.user_id = auth.uid()
    )
    OR
    (SELECT is_admin())
  );

-- RLS Policies for revenue_events
DROP POLICY IF EXISTS "Users can view revenue events for collections they have access to" ON revenue_events;
DROP POLICY IF EXISTS "Owners and admins can manage revenue events" ON revenue_events;

CREATE POLICY "Users can view revenue events for collections they have access to"
  ON revenue_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_id AND c.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM collection_access ca
      WHERE ca.collection_id = revenue_events.collection_id
      AND ca.user_id = auth.uid()
    )
    OR
    (SELECT is_admin())
  );

CREATE POLICY "Owners and admins can manage revenue events"
  ON revenue_events FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_id AND c.user_id = auth.uid()
    )
    OR
    (SELECT is_admin())
  );

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON collection_revenue_config TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON collection_individual_shares TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON item_revenue_attribution TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON revenue_events TO authenticated; 