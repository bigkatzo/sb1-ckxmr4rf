-- Remove the @merchant.local exclusion from previous migrations
ALTER TRIGGER ensure_user_profile_trigger
ON auth.users
RENAME TO ensure_user_profile_trigger_old;

-- Create updated function without @merchant.local exclusion
CREATE OR REPLACE FUNCTION ensure_user_profile()
RETURNS trigger AS $$
BEGIN
  INSERT INTO user_profiles (id, role)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF((NEW.raw_app_meta_data->>'role')::text, '')::user_role,
      'merchant'::user_role  -- Default to merchant for @merchant.local emails
    )
  )
  ON CONFLICT (id) DO UPDATE
  SET role = EXCLUDED.role;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create new trigger without exclusion
CREATE TRIGGER ensure_user_profile_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION ensure_user_profile();

-- Create profile for the new user if it doesn't exist
INSERT INTO user_profiles (id, role)
SELECT 
  id,
  'merchant'::user_role
FROM auth.users u
WHERE email = 'supauser@merchant.local'
AND NOT EXISTS (
  SELECT 1 FROM user_profiles p 
  WHERE p.id = u.id
);

-- Update metadata for the user
UPDATE auth.users
SET raw_app_meta_data = jsonb_build_object(
  'provider', COALESCE(raw_app_meta_data->>'provider', 'email'),
  'providers', ARRAY['email'],
  'role', 'merchant'
),
raw_user_meta_data = jsonb_build_object(
  'role', 'merchant'
)
WHERE email = 'supauser@merchant.local'; 