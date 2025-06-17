-- Simplify Finance Management System
-- Remove complex revenue models and focus on direct percentage sharing

-- Remove unnecessary columns from collection_revenue_config
ALTER TABLE collection_revenue_config 
DROP COLUMN IF EXISTS owner_share_percentage,
DROP COLUMN IF EXISTS editor_share_percentage,
DROP COLUMN IF EXISTS collaborator_share_percentage,
DROP COLUMN IF EXISTS viewer_share_percentage,
DROP COLUMN IF EXISTS split_model,
DROP COLUMN IF EXISTS enable_individual_splits;

-- Keep only essential fields for smart contracts and auto-distribution
-- collection_revenue_config now only stores collection-level settings
ALTER TABLE collection_revenue_config 
ADD COLUMN IF NOT EXISTS total_allocated_percentage DECIMAL(5,2) DEFAULT 0 CHECK (total_allocated_percentage >= 0 AND total_allocated_percentage <= 100);

-- Simplify collection_individual_shares - remove access_type dependency
ALTER TABLE collection_individual_shares 
DROP COLUMN IF EXISTS access_type,
DROP COLUMN IF EXISTS share_type,
DROP COLUMN IF EXISTS fixed_amount;

-- Add constraint to ensure total percentages don't exceed 100%
-- We'll handle this in application logic since SQL constraints are tricky with aggregates

-- Function to automatically create owner share when collection is created
CREATE OR REPLACE FUNCTION create_default_owner_share()
RETURNS TRIGGER AS $$
BEGIN
  -- Create default 100% share for collection owner
  INSERT INTO collection_individual_shares (
    collection_id,
    user_id,
    share_percentage,
    is_active,
    effective_from
  ) VALUES (
    NEW.id,
    NEW.user_id,
    100.00,
    true,
    NOW()
  );
  
  -- Create basic revenue config
  INSERT INTO collection_revenue_config (
    collection_id,
    total_allocated_percentage,
    auto_distribute
  ) VALUES (
    NEW.id,
    100.00,
    false
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-create owner share when collection is created
DROP TRIGGER IF EXISTS create_default_owner_share_trigger ON collections;
CREATE TRIGGER create_default_owner_share_trigger
  AFTER INSERT ON collections
  FOR EACH ROW
  EXECUTE FUNCTION create_default_owner_share();

-- Function to calculate total allocated percentage for a collection
CREATE OR REPLACE FUNCTION calculate_total_allocated_percentage(p_collection_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  total_percentage DECIMAL;
BEGIN
  SELECT COALESCE(SUM(share_percentage), 0) INTO total_percentage
  FROM collection_individual_shares
  WHERE collection_id = p_collection_id 
    AND is_active = true;
    
  RETURN total_percentage;
END;
$$ LANGUAGE plpgsql;

-- Function to update total allocated percentage
CREATE OR REPLACE FUNCTION update_total_allocated_percentage()
RETURNS TRIGGER AS $$
DECLARE
  total_percentage DECIMAL;
BEGIN
  -- Calculate new total
  total_percentage := calculate_total_allocated_percentage(
    COALESCE(NEW.collection_id, OLD.collection_id)
  );
  
  -- Update revenue config
  UPDATE collection_revenue_config 
  SET total_allocated_percentage = total_percentage,
      updated_at = NOW()
  WHERE collection_id = COALESCE(NEW.collection_id, OLD.collection_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-update total percentage when shares change
DROP TRIGGER IF EXISTS update_total_percentage_trigger ON collection_individual_shares;
CREATE TRIGGER update_total_percentage_trigger
  AFTER INSERT OR UPDATE OR DELETE ON collection_individual_shares
  FOR EACH ROW
  EXECUTE FUNCTION update_total_allocated_percentage();

-- Simplified revenue calculation function
CREATE OR REPLACE FUNCTION calculate_simple_revenue_splits(
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
      
      -- Add collaborator split for their item
      splits := splits || jsonb_build_object(
        'user_id', item_attribution.creator_id,
        'amount', collaborator_item_share,
        'percentage', item_attribution.revenue_share_percentage,
        'type', 'collaborator_item',
        'item_id', p_item_id,
        'item_type', p_item_type
      );
      
      remaining_amount := remaining_amount - collaborator_item_share;
    END IF;
  END IF;
  
  -- Then distribute remaining amount based on individual shares
  -- Get all active shares excluding the collaborator for this specific item
  FOR share_record IN
    SELECT user_id, share_percentage
    FROM collection_individual_shares
    WHERE collection_id = p_collection_id
      AND is_active = true
      AND (effective_until IS NULL OR effective_until > NOW())
      AND effective_from <= NOW()
      AND (p_item_creator_id IS NULL OR user_id != p_item_creator_id) -- Exclude item creator from general splits
    ORDER BY share_percentage DESC
  LOOP
    DECLARE
      share_amount DECIMAL;
      normalized_percentage DECIMAL;
    BEGIN
      -- Calculate normalized percentage of remaining amount
      -- This handles cases where total doesn't equal 100%
      normalized_percentage := share_record.share_percentage;
      share_amount := (remaining_amount * normalized_percentage / 100.0);
      
      IF share_amount > 0 THEN
        splits := splits || jsonb_build_object(
          'user_id', share_record.user_id,
          'amount', share_amount,
          'percentage', normalized_percentage,
          'type', 'general_share'
        );
      END IF;
    END;
  END LOOP;
  
  RETURN splits;
END;
$$;

-- Update existing collections to have owner shares
INSERT INTO collection_individual_shares (collection_id, user_id, share_percentage, is_active, effective_from)
SELECT 
  c.id as collection_id,
  c.user_id,
  100.00 as share_percentage,
  true as is_active,
  NOW() as effective_from
FROM collections c
WHERE NOT EXISTS (
  SELECT 1 FROM collection_individual_shares cis 
  WHERE cis.collection_id = c.id AND cis.user_id = c.user_id AND cis.is_active = true
);

-- Update existing revenue configs
INSERT INTO collection_revenue_config (collection_id, total_allocated_percentage, auto_distribute)
SELECT 
  c.id as collection_id,
  100.00 as total_allocated_percentage,
  false as auto_distribute
FROM collections c
WHERE NOT EXISTS (
  SELECT 1 FROM collection_revenue_config crc 
  WHERE crc.collection_id = c.id
); 