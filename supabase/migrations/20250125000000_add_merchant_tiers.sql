-- Create merchant tier type if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'merchant_tier') THEN
    CREATE TYPE merchant_tier AS ENUM (
      'starter_merchant',
      'verified_merchant',
      'trusted_merchant',
      'elite_merchant'
    );
  END IF;
END $$;

-- Add merchant_tier column to user_profiles if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'user_profiles'
    AND column_name = 'merchant_tier'
  ) THEN
    ALTER TABLE user_profiles
    ADD COLUMN merchant_tier merchant_tier NOT NULL DEFAULT 'starter_merchant';
  END IF;
END $$;

-- Add successful_sales_count column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'user_profiles'
    AND column_name = 'successful_sales_count'
  ) THEN
    ALTER TABLE user_profiles
    ADD COLUMN successful_sales_count INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Create function to increment successful sales count
CREATE OR REPLACE FUNCTION increment_merchant_sales_count()
RETURNS trigger AS $$
BEGIN
  -- Only increment when status changes to shipped or delivered for the first time
  IF (NEW.status IN ('shipped', 'delivered') AND OLD.status NOT IN ('shipped', 'delivered')) THEN
    -- Get the collection owner's ID and increment their successful sales count
    UPDATE user_profiles
    SET successful_sales_count = successful_sales_count + 1
    WHERE id = (
      SELECT c.user_id 
      FROM collections c
      JOIN products p ON p.collection_id = c.id
      WHERE p.id = NEW.product_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS increment_sales_count_trigger ON orders;

-- Create trigger to increment sales count
CREATE TRIGGER increment_sales_count_trigger
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION increment_merchant_sales_count();

-- Create function to update merchant tier based on sales count
CREATE OR REPLACE FUNCTION update_merchant_tier()
RETURNS trigger AS $$
BEGIN
  -- Only update tier if current tier is not manually set (verified or elite)
  IF NEW.successful_sales_count >= 10 AND 
     OLD.merchant_tier = 'starter_merchant' THEN
    NEW.merchant_tier = 'trusted_merchant';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_merchant_tier_trigger ON user_profiles;

-- Create trigger for automatic tier updates
CREATE TRIGGER update_merchant_tier_trigger
  BEFORE UPDATE OF successful_sales_count ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_merchant_tier();

-- Create function for admins to manually set merchant tier
CREATE OR REPLACE FUNCTION admin_set_merchant_tier(
  p_user_id uuid,
  p_tier merchant_tier
)
RETURNS void AS $$
BEGIN
  -- Verify caller is admin
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin can set merchant tiers';
  END IF;

  -- Update merchant tier
  UPDATE user_profiles
  SET merchant_tier = p_tier
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION admin_set_merchant_tier(uuid, merchant_tier) TO authenticated;

-- Set all existing merchants to starter_merchant tier if not already set
UPDATE user_profiles
SET merchant_tier = 'starter_merchant'
WHERE role = 'merchant'
AND merchant_tier IS NULL; 