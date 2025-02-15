-- Drop all existing auth-related functions and triggers
DO $$ BEGIN
  DROP FUNCTION IF EXISTS auth.is_admin() CASCADE;
  DROP FUNCTION IF EXISTS auth.has_merchant_access() CASCADE;
  DROP FUNCTION IF EXISTS ensure_user_profile() CASCADE;
  DROP FUNCTION IF EXISTS sync_user_profile() CASCADE;
  DROP FUNCTION IF EXISTS handle_auth_user() CASCADE;
  DROP TRIGGER IF EXISTS ensure_user_profile_trigger ON auth.users;
  DROP TRIGGER IF EXISTS sync_user_profile_trigger ON auth.users;
  DROP TRIGGER IF EXISTS handle_auth_user_trigger ON auth.users;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create simplified auth functions
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- Create function to ensure user profile exists
CREATE OR REPLACE FUNCTION ensure_user_profile()
RETURNS trigger AS $$
BEGIN
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
  SET role = EXCLUDED.role;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new users
CREATE TRIGGER ensure_user_profile_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION ensure_user_profile();

-- Remove any RLS policies that might interfere with auth
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "users_read_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "admin_manage_profiles" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_policy" ON user_profiles;

-- Create simplified RLS policies
CREATE POLICY "read_own_profile"
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

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO authenticated, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO authenticated, anon;
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION auth.has_merchant_access() TO authenticated, anon;

-- Create function to create users with proper auth
CREATE OR REPLACE FUNCTION create_auth_user(
  p_email text,
  p_password text,
  p_role text DEFAULT 'merchant'
)
RETURNS uuid AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Create user with proper auth settings
  INSERT INTO auth.users (
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    role,
    aud,
    created_at,
    updated_at
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    now(),
    jsonb_build_object(
      'provider', 'email',
      'providers', array['email'],
      'role', p_role
    ),
    jsonb_build_object(
      'role', p_role
    ),
    'authenticated',
    'authenticated',
    now(),
    now()
  )
  RETURNING id INTO v_user_id;

  -- Profile will be created by trigger
  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute on user creation function
GRANT EXECUTE ON FUNCTION create_auth_user(text, text, text) TO authenticated, anon; 