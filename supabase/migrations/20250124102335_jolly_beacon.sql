-- Drop existing functions first
DO $$ BEGIN
  DROP FUNCTION IF EXISTS create_user_with_role(text, text, text) CASCADE;
  DROP FUNCTION IF EXISTS validate_user_credentials(text, text) CASCADE;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create super simple admin check function
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

-- Create function to check merchant access
CREATE OR REPLACE FUNCTION auth.has_merchant_access()
RETURNS boolean AS $$
BEGIN
  -- Check if user is admin first
  IF auth.is_admin() THEN
    RETURN true;
  END IF;

  -- Check user profile for merchant role
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'merchant'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to ensure user profile matches metadata
CREATE OR REPLACE FUNCTION sync_user_profile()
RETURNS trigger AS $$
BEGIN
  -- Create or update profile based on metadata
  INSERT INTO user_profiles (id, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_app_meta_data->>'role', 'user')::user_role
  )
  ON CONFLICT (id) DO UPDATE
  SET role = COALESCE(NEW.raw_app_meta_data->>'role', 'user')::user_role;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for profile sync
DROP TRIGGER IF EXISTS sync_user_profile_trigger ON auth.users;
CREATE TRIGGER sync_user_profile_trigger
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_profile();

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

-- Remove test users
DELETE FROM auth.users 
WHERE email IN (
  'merchant@merchant.local',
  'user@merchant.local'
);

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.has_merchant_access() TO authenticated;