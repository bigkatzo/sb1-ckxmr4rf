-- Drop existing triggers and functions first
DO $$ BEGIN
  DROP TRIGGER IF EXISTS ensure_user_profile_trigger ON auth.users;
  DROP FUNCTION IF EXISTS ensure_user_profile() CASCADE;
  DROP FUNCTION IF EXISTS auth.has_merchant_access() CASCADE;
  DROP FUNCTION IF EXISTS grant_merchant_access(uuid) CASCADE;
  DROP FUNCTION IF EXISTS revoke_merchant_access(uuid) CASCADE;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create user_profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'merchant', 'user')) DEFAULT 'user',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_profiles
CREATE POLICY "users_read_own_profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR auth.is_admin());

CREATE POLICY "admin_manage_profiles"
  ON user_profiles
  FOR ALL
  TO authenticated
  USING (auth.is_admin())
  WITH CHECK (auth.is_admin());

-- Create function to ensure user profile exists
CREATE OR REPLACE FUNCTION ensure_user_profile()
RETURNS trigger AS $$
BEGIN
  -- Create profile for new user if it doesn't exist
  INSERT INTO user_profiles (id, role)
  VALUES (
    NEW.id,
    CASE 
      WHEN NEW.email = 'admin420@merchant.local' THEN 'admin'
      WHEN NEW.raw_app_meta_data->>'role' = 'merchant' THEN 'merchant'
      ELSE 'user'
    END
  )
  ON CONFLICT (id) DO UPDATE 
  SET role = CASE 
    WHEN EXCLUDED.id IN (SELECT id FROM auth.users WHERE email = 'admin420@merchant.local') THEN 'admin'
    WHEN NEW.raw_app_meta_data->>'role' = 'merchant' THEN 'merchant'
    ELSE EXCLUDED.role
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user profile creation
CREATE TRIGGER ensure_user_profile_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION ensure_user_profile();

-- Create function to check if user has merchant access
CREATE OR REPLACE FUNCTION auth.has_merchant_access()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'merchant')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to grant merchant access
CREATE OR REPLACE FUNCTION grant_merchant_access(p_user_id uuid)
RETURNS void AS $$
BEGIN
  -- Verify caller is admin
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin can grant merchant access';
  END IF;

  -- Update user profile to merchant role
  UPDATE user_profiles
  SET 
    role = 'merchant',
    updated_at = now()
  WHERE id = p_user_id;

  -- Update user metadata
  UPDATE auth.users
  SET 
    raw_app_meta_data = jsonb_set(
      COALESCE(raw_app_meta_data, '{}'::jsonb),
      '{role}',
      '"merchant"'
    ),
    raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'::jsonb),
      '{role}',
      '"merchant"'
    )
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to revoke merchant access
CREATE OR REPLACE FUNCTION revoke_merchant_access(p_user_id uuid)
RETURNS void AS $$
BEGIN
  -- Verify caller is admin
  IF NOT auth.is_admin() THEN
    RAISE EXCEPTION 'Only admin can revoke merchant access';
  END IF;

  -- Don't allow revoking admin's access
  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = p_user_id
    AND email = 'admin420@merchant.local'
  ) THEN
    RAISE EXCEPTION 'Cannot revoke admin access';
  END IF;

  -- Update user profile to user role
  UPDATE user_profiles
  SET 
    role = 'user',
    updated_at = now()
  WHERE id = p_user_id;

  -- Update user metadata
  UPDATE auth.users
  SET 
    raw_app_meta_data = jsonb_set(
      COALESCE(raw_app_meta_data, '{}'::jsonb),
      '{role}',
      '"user"'
    ),
    raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'::jsonb),
      '{role}',
      '"user"'
    )
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure all existing users have profiles
INSERT INTO user_profiles (id, role)
SELECT 
  u.id,
  CASE 
    WHEN u.email = 'admin420@merchant.local' THEN 'admin'
    WHEN u.raw_app_meta_data->>'role' = 'merchant' THEN 'merchant'
    ELSE 'user'
  END as role
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM user_profiles p WHERE p.id = u.id
)
ON CONFLICT (id) DO UPDATE 
SET role = CASE 
  WHEN EXCLUDED.id IN (SELECT id FROM auth.users WHERE email = 'admin420@merchant.local') THEN 'admin'
  WHEN (SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = EXCLUDED.id) = 'merchant' THEN 'merchant'
  ELSE EXCLUDED.role
END;

-- Grant necessary permissions
GRANT ALL ON user_profiles TO authenticated;
GRANT EXECUTE ON FUNCTION auth.has_merchant_access() TO authenticated;
GRANT EXECUTE ON FUNCTION grant_merchant_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_merchant_access(uuid) TO authenticated;