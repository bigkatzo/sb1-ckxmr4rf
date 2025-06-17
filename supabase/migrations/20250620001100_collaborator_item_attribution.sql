-- Collaborator Item Attribution System
-- This ensures collaborators only get revenue from items they created

-- Add creator tracking to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add creator tracking to categories table  
ALTER TABLE categories
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Update existing products to have creator info (set to collection owner for existing items)
UPDATE products 
SET created_by = collections.user_id
FROM collections 
WHERE products.collection_id = collections.id 
AND products.created_by IS NULL;

-- Update existing categories to have creator info
UPDATE categories
SET created_by = collections.user_id  
FROM collections
WHERE categories.collection_id = collections.id
AND categories.created_by IS NULL;

-- Item-level revenue attribution table
CREATE TABLE IF NOT EXISTS item_revenue_attribution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  item_id UUID NOT NULL, -- Can be product_id or category_id
  item_type TEXT NOT NULL CHECK (item_type IN ('product', 'category')),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  revenue_share_percentage DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (revenue_share_percentage >= 0 AND revenue_share_percentage <= 100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(item_id, item_type, is_active) DEFERRABLE INITIALLY DEFERRED
);

-- Note: Enhanced revenue events columns (category_id, item_creator_id) are now included in the base table creation

-- Function to register when a collaborator creates an item
CREATE OR REPLACE FUNCTION register_collaborator_item(
  p_collection_id UUID,
  p_item_id UUID,
  p_item_type TEXT,
  p_creator_id UUID,
  p_revenue_share_percentage DECIMAL DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  creator_access_type TEXT;
  default_share DECIMAL;
BEGIN
  -- Get creator's access type
  SELECT access_type INTO creator_access_type
  FROM collection_access
  WHERE collection_id = p_collection_id 
    AND user_id = p_creator_id;
  
  -- If creator is a collaborator, register item attribution
  IF creator_access_type = 'collaborator' THEN
    -- Get their default revenue share if not specified
    IF p_revenue_share_percentage IS NULL THEN
      SELECT share_percentage INTO default_share
      FROM collection_individual_shares
      WHERE collection_id = p_collection_id 
        AND user_id = p_creator_id 
        AND is_active = true
      LIMIT 1;
      
      -- If no individual share set, use collection config default
      IF default_share IS NULL THEN
        SELECT collaborator_share_percentage INTO default_share
        FROM collection_revenue_config
        WHERE collection_id = p_collection_id;
      END IF;
      
      p_revenue_share_percentage := COALESCE(default_share, 0);
    END IF;
    
    -- Register the attribution
    INSERT INTO item_revenue_attribution (
      collection_id,
      item_id,
      item_type,
      creator_id,
      revenue_share_percentage
    ) VALUES (
      p_collection_id,
      p_item_id,
      p_item_type,
      p_creator_id,
      p_revenue_share_percentage
    ) ON CONFLICT (item_id, item_type, is_active) 
    DO UPDATE SET
      creator_id = EXCLUDED.creator_id,
      revenue_share_percentage = EXCLUDED.revenue_share_percentage,
      updated_at = NOW();
  END IF;
END;
$$;

-- Enhanced revenue calculation that handles item-level attribution
CREATE OR REPLACE FUNCTION calculate_item_revenue_splits(
  p_collection_id UUID,
  p_product_id UUID,
  p_category_id UUID,
  p_total_amount DECIMAL,
  p_sale_creator_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  config RECORD;
  splits JSONB := '[]'::JSONB;
  item_attribution RECORD;
  collaborator_share DECIMAL := 0;
  remaining_amount DECIMAL := p_total_amount;
  owner_id UUID;
  collection_owner_share DECIMAL;
BEGIN
  -- Get collection owner
  SELECT user_id INTO owner_id
  FROM collections
  WHERE id = p_collection_id;
  
  -- Get revenue configuration
  SELECT * INTO config
  FROM collection_revenue_config
  WHERE collection_id = p_collection_id;
  
  -- Default to 100% owner if no config
  IF NOT FOUND THEN
    config.owner_share_percentage := 100;
    config.enable_individual_splits := false;
  END IF;
  
  -- Check if this sale involves collaborator-created items
  -- First check product attribution
  IF p_product_id IS NOT NULL THEN
    SELECT * INTO item_attribution
    FROM item_revenue_attribution
    WHERE item_id = p_product_id 
      AND item_type = 'product' 
      AND is_active = true;
      
    IF FOUND THEN
      collaborator_share := (p_total_amount * item_attribution.revenue_share_percentage / 100.0);
      
      -- Add collaborator split
      splits := splits || jsonb_build_object(
        'user_id', item_attribution.creator_id,
        'amount', collaborator_share,
        'percentage', item_attribution.revenue_share_percentage,
        'share_type', 'collaborator_item',
        'item_id', p_product_id,
        'item_type', 'product'
      );
      
      remaining_amount := remaining_amount - collaborator_share;
    END IF;
  END IF;
  
  -- Then check category attribution (if no product attribution found)
  IF p_category_id IS NOT NULL AND collaborator_share = 0 THEN
    SELECT * INTO item_attribution
    FROM item_revenue_attribution
    WHERE item_id = p_category_id 
      AND item_type = 'category' 
      AND is_active = true;
      
    IF FOUND THEN
      collaborator_share := (p_total_amount * item_attribution.revenue_share_percentage / 100.0);
      
      -- Add collaborator split
      splits := splits || jsonb_build_object(
        'user_id', item_attribution.creator_id,
        'amount', collaborator_share,
        'percentage', item_attribution.revenue_share_percentage,
        'share_type', 'collaborator_item',
        'item_id', p_category_id,
        'item_type', 'category'
      );
      
      remaining_amount := remaining_amount - collaborator_share;
    END IF;
  END IF;
  
  -- Distribute remaining amount among non-collaborator shares
  IF config.enable_individual_splits THEN
    -- Use individual shares for remaining amount (excluding collaborators)
    FOR item_attribution IN
      SELECT user_id, share_percentage, access_type
      FROM collection_individual_shares
      WHERE collection_id = p_collection_id
        AND is_active = true
        AND access_type != 'collaborator' -- Exclude collaborators from collection-wide splits
        AND (effective_until IS NULL OR effective_until > NOW())
        AND effective_from <= NOW()
    LOOP
      DECLARE
        share_amount DECIMAL;
      BEGIN
        share_amount := (remaining_amount * item_attribution.share_percentage / 100.0);
        
        IF share_amount > 0 THEN
          splits := splits || jsonb_build_object(
            'user_id', item_attribution.user_id,
            'amount', share_amount,
            'percentage', item_attribution.share_percentage,
            'share_type', item_attribution.access_type,
            'calculation_method', 'individual_share'
          );
        END IF;
      END;
    END LOOP;
  ELSE
    -- Default: remaining amount goes to collection owner
    IF remaining_amount > 0 AND owner_id IS NOT NULL THEN
      splits := splits || jsonb_build_object(
        'user_id', owner_id,
        'amount', remaining_amount,
        'percentage', (remaining_amount / p_total_amount * 100),
        'share_type', 'owner',
        'calculation_method', 'remainder'
      );
    END IF;
  END IF;
  
  RETURN splits;
END;
$$;

-- Trigger to automatically register collaborator items when products are created
CREATE OR REPLACE FUNCTION auto_register_collaborator_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Register item attribution for collaborators
  PERFORM register_collaborator_item(
    NEW.collection_id,
    NEW.id,
    TG_TABLE_NAME::TEXT, -- 'products' or 'categories'
    NEW.created_by,
    NULL -- Use default share percentage
  );
  
  RETURN NEW;
END;
$$;

-- Create triggers for automatic registration
CREATE TRIGGER auto_register_product_attribution
  AFTER INSERT ON products
  FOR EACH ROW
  WHEN (NEW.created_by IS NOT NULL)
  EXECUTE FUNCTION auto_register_collaborator_item();

CREATE TRIGGER auto_register_category_attribution
  AFTER INSERT ON categories
  FOR EACH ROW
  WHEN (NEW.created_by IS NOT NULL)
  EXECUTE FUNCTION auto_register_collaborator_item();

-- Enhanced revenue event recording with item-level attribution
CREATE OR REPLACE FUNCTION record_item_revenue_event(
  p_collection_id UUID,
  p_product_id UUID DEFAULT NULL,
  p_category_id UUID DEFAULT NULL,
  p_total_amount DECIMAL,
  p_currency TEXT DEFAULT 'SOL',
  p_sale_creator_id UUID DEFAULT NULL,
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
  item_creator_id UUID;
BEGIN
  -- Get item creator for attribution
  IF p_product_id IS NOT NULL THEN
    SELECT created_by INTO item_creator_id
    FROM products
    WHERE id = p_product_id;
  ELSIF p_category_id IS NOT NULL THEN
    SELECT created_by INTO item_creator_id
    FROM categories
    WHERE id = p_category_id;
  END IF;
  
  -- Calculate revenue splits with item-level attribution
  calculated_splits := calculate_item_revenue_splits(
    p_collection_id,
    p_product_id,
    p_category_id,
    p_total_amount,
    p_sale_creator_id
  );
  
  -- Insert revenue event
  INSERT INTO revenue_events (
    collection_id,
    product_id,
    category_id,
    order_id,
    total_amount,
    currency,
    primary_contributor_id,
    item_creator_id,
    revenue_splits,
    transaction_hash,
    smart_contract_address,
    block_number,
    status
  ) VALUES (
    p_collection_id,
    p_product_id,
    p_category_id,
    p_order_id,
    p_total_amount,
    p_currency,
    p_sale_creator_id,
    item_creator_id,
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_item_revenue_attribution_item ON item_revenue_attribution(item_id, item_type);
CREATE INDEX IF NOT EXISTS idx_item_revenue_attribution_creator ON item_revenue_attribution(creator_id);
CREATE INDEX IF NOT EXISTS idx_item_revenue_attribution_collection ON item_revenue_attribution(collection_id);
CREATE INDEX IF NOT EXISTS idx_products_created_by ON products(created_by);
CREATE INDEX IF NOT EXISTS idx_categories_created_by ON categories(created_by);

-- Enable RLS
ALTER TABLE item_revenue_attribution ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view item attribution for collections they have access to" ON item_revenue_attribution;
DROP POLICY IF EXISTS "Owners and admins can manage item attribution" ON item_revenue_attribution;

-- RLS Policies
CREATE POLICY "Users can view item attribution for collections they have access to"
  ON item_revenue_attribution FOR SELECT
  USING (
    -- Collection owner can view
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_id AND c.user_id = auth.uid()
    )
    OR
    -- Users with access can view
    EXISTS (
      SELECT 1 FROM collection_access ca
      WHERE ca.collection_id = item_revenue_attribution.collection_id
      AND ca.user_id = auth.uid()
    )
    OR
    -- Admins can view all
    (SELECT is_admin())
  );

CREATE POLICY "Owners and admins can manage item attribution"
  ON item_revenue_attribution FOR ALL
  USING (
    -- Collection owner can manage
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_id AND c.user_id = auth.uid()
    )
    OR
    -- Admins can manage all
    (SELECT is_admin())
  );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON item_revenue_attribution TO authenticated;
GRANT EXECUTE ON FUNCTION register_collaborator_item TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_item_revenue_splits TO authenticated;
GRANT EXECUTE ON FUNCTION record_item_revenue_event TO authenticated; 