-- Drop existing functions and triggers first
DO $$ BEGIN
  DROP FUNCTION IF EXISTS auth.is_admin() CASCADE;
  DROP FUNCTION IF EXISTS auth.get_user_role() CASCADE;
  DROP FUNCTION IF EXISTS validate_user_credentials(text, text) CASCADE;
  DROP FUNCTION IF EXISTS handle_auth_user() CASCADE;
  DROP TRIGGER IF EXISTS handle_auth_user_trigger ON auth.users;
  DROP TRIGGER IF EXISTS auth_user_trigger ON auth.users;
  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
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

  RETURN COALESCE(v_role, 'user');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to validate user credentials
CREATE OR REPLACE FUNCTION validate_user_credentials(
  p_email text,
  p_password text
)
RETURNS TABLE (
  id uuid,
  email text,
  role text,
  is_admin boolean,
  has_collections boolean,
  has_access boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    COALESCE(p.role, 'user') as role,
    u.email = 'admin420@merchant.local' as is_admin,
    EXISTS (
      SELECT 1 FROM collections c WHERE c.user_id = u.id
    ) as has_collections,
    EXISTS (
      SELECT 1 FROM collection_access ca WHERE ca.user_id = u.id
    ) as has_access
  FROM auth.users u
  LEFT JOIN user_profiles p ON p.id = u.id
  WHERE u.email = p_email
  AND u.encrypted_password = crypt(p_password, u.encrypted_password);
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
    'username', NEW.username
  );
  
  -- Set raw_user_meta_data
  NEW.raw_user_meta_data := jsonb_build_object(
    'username', NEW.username
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
      ELSE 'user'
    END
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user handling
CREATE TRIGGER new_user_trigger
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auth.handle_new_user();

-- Create function to check database connection
CREATE OR REPLACE FUNCTION check_database_connection()
RETURNS boolean AS $$
BEGIN
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure all existing users have profiles
INSERT INTO user_profiles (id, role)
SELECT 
  u.id,
  CASE 
    WHEN u.email = 'admin420@merchant.local' THEN 'admin'
    ELSE 'user'
  END as role
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM user_profiles p WHERE p.id = u.id
)
ON CONFLICT (id) DO UPDATE 
SET role = CASE 
  WHEN EXCLUDED.id IN (SELECT id FROM auth.users WHERE email = 'admin420@merchant.local') THEN 'admin'
  ELSE EXCLUDED.role
END;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION validate_user_credentials(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION check_database_connection() TO authenticated;
GRANT ALL ON user_profiles TO authenticated;