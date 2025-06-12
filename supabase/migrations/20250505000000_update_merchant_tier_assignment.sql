-- Drop existing function
DROP FUNCTION IF EXISTS admin_set_merchant_tier(uuid, merchant_tier);

-- Recreate function without role restrictions
CREATE OR REPLACE FUNCTION admin_set_merchant_tier(
  p_user_id uuid,
  p_tier merchant_tier
)
RETURNS void AS $$
BEGIN
  -- Verify caller has admin role (for access control only)
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin can set merchant tiers';
  END IF;

  -- Update verification tier - can be set for any user regardless of their role
  -- This tier is what determines which badge icon shows up
  UPDATE user_profiles
  SET 
    merchant_tier = p_tier,
    updated_at = now()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION admin_set_merchant_tier(uuid, merchant_tier) TO authenticated;

-- Update any existing user_profiles to ensure merchant_tier is set
UPDATE user_profiles
SET 
  merchant_tier = COALESCE(merchant_tier, 'starter_merchant'),
  updated_at = now()
WHERE merchant_tier IS NULL; 