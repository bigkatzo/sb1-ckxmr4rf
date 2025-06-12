-- Create merchant tier type
CREATE TYPE merchant_tier AS ENUM (
  'starter_merchant',
  'verified_merchant',
  'trusted_merchant',
  'elite_merchant'
);

-- Add merchant_tier column to user_profiles
ALTER TABLE user_profiles
ADD COLUMN merchant_tier merchant_tier NOT NULL DEFAULT 'starter_merchant';

-- Add successful_sales_count column to track sales for trusted_merchant status
ALTER TABLE user_profiles
ADD COLUMN successful_sales_count INTEGER NOT NULL DEFAULT 0;

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

-- Set all existing merchants to starter_merchant tier
UPDATE user_profiles
SET merchant_tier = 'starter_merchant'
WHERE role = 'merchant'; 