-- Start transaction
BEGIN;

-- Create a temporary function to recalculate successful sales counts
CREATE OR REPLACE FUNCTION recalculate_successful_sales_count()
RETURNS void AS $$
BEGIN
  -- Reset all successful sales counts to 0
  UPDATE user_profiles
  SET successful_sales_count = 0;

  -- Recalculate successful sales counts based on all shipped/delivered orders
  WITH merchant_sales AS (
    SELECT 
      c.user_id,
      COUNT(DISTINCT o.id) as sales_count
    FROM orders o
    JOIN products p ON p.id = o.product_id
    JOIN collections c ON c.id = p.collection_id
    WHERE o.status IN ('shipped', 'delivered')
    GROUP BY c.user_id
  )
  UPDATE user_profiles up
  SET successful_sales_count = COALESCE(ms.sales_count, 0)
  FROM merchant_sales ms
  WHERE up.id = ms.user_id;

  -- Update merchant tiers based on new sales counts
  UPDATE user_profiles
  SET merchant_tier = CASE
    WHEN successful_sales_count >= 10 THEN 'trusted_merchant'::merchant_tier
    ELSE 'starter_merchant'::merchant_tier
  END
  WHERE merchant_tier != 'elite_merchant'::merchant_tier; -- Don't change elite merchants
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Execute the recalculation
SELECT recalculate_successful_sales_count();

-- Drop the temporary function
DROP FUNCTION recalculate_successful_sales_count();

-- Update the increment_merchant_sales_count trigger function to be more robust
CREATE OR REPLACE FUNCTION increment_merchant_sales_count()
RETURNS trigger AS $$
DECLARE
  v_collection_owner_id uuid;
BEGIN
  -- Only increment when status changes to shipped or delivered for the first time
  IF (NEW.status IN ('shipped', 'delivered') AND OLD.status NOT IN ('shipped', 'delivered')) THEN
    -- Get the collection owner's ID with better error handling
    SELECT c.user_id INTO v_collection_owner_id
    FROM collections c
    JOIN products p ON p.collection_id = c.id
    WHERE p.id = NEW.product_id;

    -- Only update if we found a valid collection owner
    IF v_collection_owner_id IS NOT NULL THEN
      UPDATE user_profiles
      SET 
        successful_sales_count = successful_sales_count + 1,
        -- Also update merchant tier if needed
        merchant_tier = CASE
          WHEN successful_sales_count + 1 >= 10 AND merchant_tier = 'starter_merchant'::merchant_tier THEN 'trusted_merchant'::merchant_tier
          ELSE merchant_tier
        END
      WHERE id = v_collection_owner_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger to ensure it's properly set up
DROP TRIGGER IF EXISTS increment_sales_count_trigger ON orders;
CREATE TRIGGER increment_sales_count_trigger
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION increment_merchant_sales_count();

COMMIT; 