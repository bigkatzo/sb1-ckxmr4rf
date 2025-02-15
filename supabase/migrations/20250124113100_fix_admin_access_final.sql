-- Drop existing functions to recreate them
DO $$ BEGIN
  DROP FUNCTION IF EXISTS auth.is_admin() CASCADE;
  DROP FUNCTION IF EXISTS debug_admin_access() CASCADE;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Create robust admin check function
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
DECLARE
  v_user_id uuid;
  v_user_email text;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  -- Exit early if no user ID
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Get user email
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = v_user_id;

  -- Check if user is admin420
  IF v_user_email = 'admin420@merchant.local' THEN
    -- Ensure admin profile exists and is correct
    INSERT INTO user_profiles (id, role)
    VALUES (v_user_id, 'admin')
    ON CONFLICT (id) DO UPDATE 
    SET role = 'admin'
    WHERE user_profiles.id = v_user_id;

    -- Update user metadata
    UPDATE auth.users
    SET 
      raw_app_meta_data = jsonb_build_object(
        'provider', 'email',
        'providers', array['email'],
        'role', 'admin'
      ),
      raw_user_meta_data = jsonb_build_object(
        'role', 'admin'
      ),
      role = 'authenticated'
    WHERE id = v_user_id;

    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create debug function with better error handling
CREATE OR REPLACE FUNCTION debug_admin_access()
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_result jsonb;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  -- Build debug info
  SELECT jsonb_build_object(
    'user_id', v_user_id,
    'email', u.email,
    'auth_role', u.role,
    'metadata_role', u.raw_app_meta_data->>'role',
    'profile_exists', EXISTS (SELECT 1 FROM user_profiles WHERE id = v_user_id),
    'profile_role', p.role,
    'is_admin', auth.is_admin()
  )
  INTO v_result
  FROM auth.users u
  LEFT JOIN user_profiles p ON p.id = u.id
  WHERE u.id = v_user_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure admin420 has correct setup
DO $$ 
DECLARE
  v_admin_id uuid;
  v_admin_exists boolean;
BEGIN
  -- Check if admin420 exists
  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'admin420@merchant.local'
  ) INTO v_admin_exists;

  IF v_admin_exists THEN
    -- Get admin ID
    SELECT id INTO v_admin_id
    FROM auth.users
    WHERE email = 'admin420@merchant.local';

    -- Update admin420
    UPDATE auth.users
    SET 
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      raw_app_meta_data = jsonb_build_object(
        'provider', 'email',
        'providers', array['email'],
        'role', 'admin'
      ),
      raw_user_meta_data = jsonb_build_object(
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
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION debug_admin_access() TO authenticated;
GRANT ALL ON user_profiles TO authenticated;

-- Ensure RLS is enabled
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Update RLS policies
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