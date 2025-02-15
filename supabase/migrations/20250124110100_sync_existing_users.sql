-- Create profiles for any existing users that don't have them
INSERT INTO user_profiles (id, role)
SELECT 
  id,
  CASE 
    WHEN raw_app_meta_data->>'role' IN ('admin', 'merchant') THEN (raw_app_meta_data->>'role')::user_role
    ELSE 'user'::user_role
  END as role
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM user_profiles p 
  WHERE p.id = u.id
)
AND email NOT LIKE '%@merchant.local';

-- Update existing profiles to match metadata if it exists
UPDATE user_profiles p
SET role = CASE 
    WHEN u.raw_app_meta_data->>'role' IN ('admin', 'merchant') THEN (u.raw_app_meta_data->>'role')::user_role
    ELSE p.role -- Keep existing role if metadata role is invalid
  END
FROM auth.users u
WHERE p.id = u.id
AND u.raw_app_meta_data->>'role' IS NOT NULL
AND u.email NOT LIKE '%@merchant.local';

-- Create function to ensure new users always get a profile
CREATE OR REPLACE FUNCTION ensure_user_profile()
RETURNS trigger AS $$
BEGIN
  INSERT INTO user_profiles (id, role)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF((NEW.raw_app_meta_data->>'role')::text, '')::user_role,
      'user'::user_role
    )
  )
  ON CONFLICT (id) DO UPDATE
  SET role = EXCLUDED.role;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user creation
DROP TRIGGER IF EXISTS ensure_user_profile_trigger ON auth.users;
CREATE TRIGGER ensure_user_profile_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION ensure_user_profile(); 