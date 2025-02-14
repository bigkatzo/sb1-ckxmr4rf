-- Drop existing functions first
DO $$ BEGIN
  DROP FUNCTION IF EXISTS auth.is_admin() CASCADE;
  DROP FUNCTION IF EXISTS auth.has_merchant_access() CASCADE;
  DROP FUNCTION IF EXISTS sync_user_profile() CASCADE;
  DROP TRIGGER IF EXISTS sync_user_profile_trigger ON auth.users;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create super simple admin check function
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'email', '') = 'admin420@merchant.local';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check merchant access
CREATE OR REPLACE FUNCTION auth.has_merchant_access()
RETURNS boolean AS $$
BEGIN
  -- Check if user is admin first
  IF auth.is_admin() THEN
    RETURN true;
  END IF;

  -- Check user metadata for merchant role
  RETURN (
    SELECT raw_app_meta_data->>'role' = 'merchant'
    FROM auth.users
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to handle user creation/update
CREATE OR REPLACE FUNCTION handle_auth_user()
RETURNS trigger AS $$
BEGIN
  -- Set default metadata if not present
  IF NEW.raw_app_meta_data IS NULL OR NEW.raw_app_meta_data = '{}'::jsonb THEN
    NEW.raw_app_meta_data := jsonb_build_object(
      'provider', 'username',
      'providers', array['username'],
      'username', split_part(NEW.email, '@', 1),
      'role', 'user'
    );
  END IF;

  IF NEW.raw_user_meta_data IS NULL OR NEW.raw_user_meta_data = '{}'::jsonb THEN
    NEW.raw_user_meta_data := jsonb_build_object(
      'username', split_part(NEW.email, '@', 1),
      'role', 'user'
    );
  END IF;

  -- Ensure email is confirmed for merchant.local users
  IF NEW.email LIKE '%@merchant.local' THEN
    NEW.email_confirmed_at := COALESCE(NEW.email_confirmed_at, now());
  END IF;

  -- Set role to authenticated
  NEW.role := 'authenticated';

  -- Create or update profile
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

-- Create trigger for auth user handling
DROP TRIGGER IF EXISTS handle_auth_user_trigger ON auth.users;
CREATE TRIGGER handle_auth_user_trigger
  BEFORE INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_auth_user();

-- Ensure admin420 exists with correct metadata
DO $$ 
DECLARE
  v_admin_id uuid;
BEGIN
  -- Get or create admin420
  SELECT id INTO v_admin_id
  FROM auth.users
  WHERE email = 'admin420@merchant.local';

  IF v_admin_id IS NULL THEN
    -- Create admin420 if doesn't exist
    INSERT INTO auth.users (
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      role
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      'admin420@merchant.local',
      crypt('NeverSt0pClickin!', gen_salt('bf')),
      now(),
      jsonb_build_object(
        'provider', 'username',
        'providers', array['username'],
        'username', 'admin420',
        'role', 'admin'
      ),
      jsonb_build_object(
        'username', 'admin420',
        'role', 'admin'
      ),
      'authenticated'
    );
  ELSE
    -- Update existing admin420
    UPDATE auth.users
    SET 
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      raw_app_meta_data = jsonb_build_object(
        'provider', 'username',
        'providers', array['username'],
        'username', 'admin420',
        'role', 'admin'
      ),
      raw_user_meta_data = jsonb_build_object(
        'username', 'admin420',
        'role', 'admin'
      ),
      role = 'authenticated'
    WHERE id = v_admin_id;
  END IF;
END $$;

-- Create RLS policies for user_profiles
DROP POLICY IF EXISTS "users_read_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "admin_manage_profiles" ON user_profiles;

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

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.has_merchant_access() TO authenticated;
GRANT ALL ON user_profiles TO authenticated;