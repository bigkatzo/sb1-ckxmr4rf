-- Drop existing functions first
DO $$ BEGIN
  DROP FUNCTION IF EXISTS auth.is_admin() CASCADE;
  DROP FUNCTION IF EXISTS auth.get_user_role() CASCADE;
  DROP FUNCTION IF EXISTS auth.handle_new_user() CASCADE;
  DROP TRIGGER IF EXISTS new_auth_user_trigger ON auth.users;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create simplified admin check function
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  -- Use direct email check with proper null handling
  RETURN NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'email', '') = 'admin420@merchant.local';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user role
CREATE OR REPLACE FUNCTION auth.get_user_role()
RETURNS text AS $$
DECLARE
  v_role text;
BEGIN
  -- First check if user is admin420
  IF auth.is_admin() THEN
    RETURN 'admin';
  END IF;

  -- Get role from user_profiles
  SELECT role INTO v_role
  FROM user_profiles
  WHERE id = auth.uid();

  -- Ensure role is one of the three valid types
  IF v_role NOT IN ('admin', 'merchant', 'user') THEN
    v_role := 'user';
  END IF;

  RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to handle new user setup
CREATE OR REPLACE FUNCTION auth.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  -- Extract username from email (remove @merchant.local)
  NEW.username := split_part(NEW.email, '@', 1);
  
  -- Set raw_app_meta_data
  NEW.raw_app_meta_data := jsonb_build_object(
    'provider', 'username',
    'providers', array['username'],
    'username', NEW.username,
    'role', CASE 
      WHEN NEW.email = 'admin420@merchant.local' THEN 'admin'
      WHEN NEW.raw_app_meta_data->>'role' = 'merchant' THEN 'merchant'
      ELSE 'user'
    END
  );
  
  -- Set raw_user_meta_data
  NEW.raw_user_meta_data := jsonb_build_object(
    'username', NEW.username,
    'role', CASE 
      WHEN NEW.email = 'admin420@merchant.local' THEN 'admin'
      WHEN NEW.raw_app_meta_data->>'role' = 'merchant' THEN 'merchant'
      ELSE 'user'
    END
  );
  
  -- Set email_confirmed_at for immediate access
  NEW.email_confirmed_at := now();
  
  -- Set role to authenticated
  NEW.role := 'authenticated';
  
  -- Create user profile immediately
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
    ELSE 'user'
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user handling
CREATE TRIGGER new_auth_user_trigger
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auth.handle_new_user();

-- Add constraint to user_profiles to enforce valid roles
ALTER TABLE user_profiles
DROP CONSTRAINT IF EXISTS valid_role_types;

ALTER TABLE user_profiles
ADD CONSTRAINT valid_role_types
CHECK (role IN ('admin', 'merchant', 'user'));

-- Update all existing users to have valid roles
UPDATE user_profiles
SET role = CASE 
  WHEN id IN (SELECT id FROM auth.users WHERE email = 'admin420@merchant.local') THEN 'admin'
  WHEN id IN (SELECT id FROM auth.users WHERE raw_app_meta_data->>'role' = 'merchant') THEN 'merchant'
  ELSE 'user'
END;

-- Update all existing users' metadata
UPDATE auth.users
SET 
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  raw_app_meta_data = jsonb_build_object(
    'provider', 'username',
    'providers', array['username'],
    'username', split_part(email, '@', 1),
    'role', CASE 
      WHEN email = 'admin420@merchant.local' THEN 'admin'
      WHEN raw_app_meta_data->>'role' = 'merchant' THEN 'merchant'
      ELSE 'user'
    END
  ),
  raw_user_meta_data = jsonb_build_object(
    'username', split_part(email, '@', 1),
    'role', CASE 
      WHEN email = 'admin420@merchant.local' THEN 'admin'
      WHEN raw_app_meta_data->>'role' = 'merchant' THEN 'merchant'
      ELSE 'user'
    END
  );

-- Ensure all users have profiles with valid roles
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
  ELSE 'user'
END;

-- Create RLS policy for user_profiles
DROP POLICY IF EXISTS "user_profiles_policy" ON user_profiles;
CREATE POLICY "user_profiles_policy"
  ON user_profiles
  FOR ALL
  TO authenticated
  USING (true)  -- Allow reading all profiles
  WITH CHECK (auth.is_admin());  -- Only admin can modify

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.get_user_role() TO authenticated;
GRANT ALL ON user_profiles TO authenticated;