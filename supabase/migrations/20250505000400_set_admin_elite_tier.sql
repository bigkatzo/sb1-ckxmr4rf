-- Add a trigger to automatically set elite tier for admin users
CREATE OR REPLACE FUNCTION set_admin_elite_tier()
RETURNS TRIGGER AS $$
BEGIN
  -- If the role is being set to admin, also set elite_merchant tier
  IF NEW.role = 'admin' OR EXISTS (
    SELECT 1 FROM auth.users WHERE id = NEW.id AND email = 'admin420@merchant.local'
  ) THEN
    NEW.merchant_tier = 'elite_merchant';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS ensure_admin_elite_tier ON user_profiles;

-- Create the trigger
CREATE TRIGGER ensure_admin_elite_tier
  BEFORE INSERT OR UPDATE OF role
  ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_admin_elite_tier();

-- Update existing admin users
DO $$
BEGIN
  -- Update existing admin users in user_profiles
  UPDATE user_profiles
  SET merchant_tier = 'elite_merchant'
  WHERE role = 'admin' OR id IN (
    SELECT id FROM auth.users WHERE email = 'admin420@merchant.local'
  );

  -- Create profiles for admin420 if it doesn't have one yet
  INSERT INTO user_profiles (id, role, merchant_tier)
  SELECT 
    u.id,
    'admin',
    'elite_merchant'
  FROM auth.users u
  LEFT JOIN user_profiles p ON u.id = p.id
  WHERE u.email = 'admin420@merchant.local'
  AND p.id IS NULL;
END $$; 