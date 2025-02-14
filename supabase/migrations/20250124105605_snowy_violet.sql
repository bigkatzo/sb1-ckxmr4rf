-- Drop existing triggers first
DO $$ BEGIN
  DROP TRIGGER IF EXISTS ensure_user_profile_trigger ON auth.users;
  DROP TRIGGER IF EXISTS handle_auth_user_trigger ON auth.users;
  DROP TRIGGER IF EXISTS create_user_profile_trigger ON auth.users;
  DROP TRIGGER IF EXISTS sync_user_profile_trigger ON auth.users;
  DROP FUNCTION IF EXISTS ensure_user_profile() CASCADE;
  DROP FUNCTION IF EXISTS handle_auth_user() CASCADE;
  DROP FUNCTION IF EXISTS create_user_profile_on_signup() CASCADE;
  DROP FUNCTION IF EXISTS sync_user_profile() CASCADE;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create function to handle user creation/update
CREATE OR REPLACE FUNCTION handle_auth_user()
RETURNS trigger AS $$
BEGIN
  -- Extract username from email
  NEW.username := split_part(NEW.email, '@', 1);

  -- Set default metadata if not present
  IF NEW.raw_app_meta_data IS NULL OR NEW.raw_app_meta_data = '{}'::jsonb THEN
    NEW.raw_app_meta_data := jsonb_build_object(
      'provider', 'username',
      'providers', array['username'],
      'username', NEW.username,
      'role', CASE 
        WHEN NEW.email = 'admin420@merchant.local' THEN 'admin'
        ELSE 'user'
      END
    );
  END IF;

  IF NEW.raw_user_meta_data IS NULL OR NEW.raw_user_meta_data = '{}'::jsonb THEN
    NEW.raw_user_meta_data := jsonb_build_object(
      'username', NEW.username,
      'role', CASE 
        WHEN NEW.email = 'admin420@merchant.local' THEN 'admin'
        ELSE 'user'
      END
    );
  END IF;

  -- Ensure email is confirmed for merchant.local users
  IF NEW.email LIKE '%@merchant.local' THEN
    NEW.email_confirmed_at := COALESCE(NEW.email_confirmed_at, now());
  END IF;

  -- Set role to authenticated
  NEW.role := 'authenticated';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for user management
CREATE TRIGGER handle_auth_user_trigger
  BEFORE INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_auth_user();

-- Create function to ensure profile exists
CREATE OR REPLACE FUNCTION ensure_user_profile()
RETURNS trigger AS $$
BEGIN
  -- Create profile after user is created
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

-- Create trigger for profile creation
CREATE TRIGGER ensure_user_profile_trigger
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION ensure_user_profile();

-- Update admin420's metadata if exists
DO $$ 
DECLARE
  v_admin_id uuid;
BEGIN
  -- Get existing admin420 ID
  SELECT id INTO v_admin_id
  FROM auth.users
  WHERE email = 'admin420@merchant.local';

  IF v_admin_id IS NOT NULL THEN
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

    -- Ensure admin profile exists
    INSERT INTO user_profiles (id, role)
    VALUES (v_admin_id, 'admin')
    ON CONFLICT (id) DO UPDATE
    SET role = 'admin';
  END IF;
END $$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT ALL ON user_profiles TO authenticated;