-- Drop existing functions and triggers first
DO $$ BEGIN
  DROP FUNCTION IF EXISTS auth.is_admin() CASCADE;
  DROP FUNCTION IF EXISTS auth.get_user_role() CASCADE;
  DROP FUNCTION IF EXISTS validate_user_credentials(text, text) CASCADE;
  DROP FUNCTION IF EXISTS auth.handle_new_user() CASCADE;
  DROP TRIGGER IF EXISTS new_auth_user_trigger ON auth.users;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create simplified admin check function that doesn't rely on profiles
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  -- Use direct email check with proper null handling
  RETURN NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'email', '') = 'admin420@merchant.local';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user role with fallback
CREATE OR REPLACE FUNCTION auth.get_user_role()
RETURNS text AS $$
BEGIN
  -- First check if user is admin420
  IF auth.is_admin() THEN
    RETURN 'admin';
  END IF;

  -- Get role from user_profiles with fallback
  RETURN COALESCE(
    (
      SELECT role 
      FROM user_profiles 
      WHERE id = auth.uid()
    ),
    'user'
  );
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
      ELSE 'user'
    END
  );
  
  -- Set raw_user_meta_data
  NEW.raw_user_meta_data := jsonb_build_object(
    'username', NEW.username,
    'role', CASE 
      WHEN NEW.email = 'admin420@merchant.local' THEN 'admin'
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
      ELSE 'user'
    END
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user handling
CREATE TRIGGER new_auth_user_trigger
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
DO $$ 
DECLARE
  v_user record;
BEGIN
  FOR v_user IN SELECT * FROM auth.users LOOP
    INSERT INTO user_profiles (id, role)
    VALUES (
      v_user.id,
      CASE 
        WHEN v_user.email = 'admin420@merchant.local' THEN 'admin'
        WHEN v_user.raw_app_meta_data->>'role' = 'merchant' THEN 'merchant'
        ELSE 'user'
      END
    )
    ON CONFLICT (id) DO UPDATE 
    SET role = CASE 
      WHEN EXCLUDED.id IN (SELECT id FROM auth.users WHERE email = 'admin420@merchant.local') THEN 'admin'
      WHEN v_user.raw_app_meta_data->>'role' = 'merchant' THEN 'merchant'
      ELSE EXCLUDED.role
    END;
  END LOOP;
END $$;

-- Create RLS policies for user_profiles
DROP POLICY IF EXISTS "user_profiles_policy" ON user_profiles;
CREATE POLICY "user_profiles_policy"
  ON user_profiles
  FOR ALL
  TO authenticated
  USING (true)  -- Allow reading all profiles
  WITH CHECK (
    -- Only allow admin to modify profiles
    auth.is_admin()
  );

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION check_database_connection() TO authenticated;
GRANT ALL ON user_profiles TO authenticated;